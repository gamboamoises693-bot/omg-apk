"use client";

import { useMemo, useState } from "react";
import { collection, doc, increment, query, where, writeBatch } from "firebase/firestore";
import { Download, ExternalLink, FileText, Phone } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { logActivity } from "@/lib/activity";
import { friendlyError, telHref, timeAgo, tsToMillis } from "@/lib/format";
import { APPLICATION_STATUS, slotsLabel, type Application, type ApplicationStatus, type Opening } from "@/lib/hiring";
import { Badge, Button, EmptyState, FilterTabs, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";

type Tab = "new" | "interview" | "hired" | "rejected";
const TAB_LABEL: Record<Tab, string> = { new: "Bago", interview: "Interview", hired: "Hired", rejected: "Hindi" };

/** Employer: everyone who applied to one opening. Hiring somebody fills a slot; a full opening becomes "Puno na". */
export function Applicants({ opening }: { opening: Opening }) {
  const { user } = useAuth();
  const toast = useToast();
  const q = useMemo(
    () => (user ? query(collection(db, "applications"), where("employerId", "==", user.uid), where("openingId", "==", opening.id)) : null),
    [user, opening.id],
  );
  const { data, loading, error } = useCollection<Application>(q);
  const [tab, setTab] = useState<Tab>("new");
  const [busy, setBusy] = useState<string | null>(null);

  const count = (s: ApplicationStatus) => data.filter((a) => a.status === s).length;
  const list = data.filter((a) => a.status === tab).sort((a, b) => tsToMillis(a.createdAt) - tsToMillis(b.createdAt));

  const setStatus = async (a: Application, next: ApplicationStatus) => {
    if (next === a.status) return;
    setBusy(a.id);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "applications", a.id), { status: next });
      // Hired people fill a slot (and free it again if the decision is undone).
      const delta = (next === "hired" ? 1 : 0) - (a.status === "hired" ? 1 : 0);
      if (delta !== 0) {
        const filled = Math.min(opening.slots, Math.max(0, opening.filled + delta));
        const state = opening.state === "closed" ? "closed" : filled >= opening.slots ? "full" : "open";
        batch.update(doc(db, "openings", opening.id), { filled: increment(filled - opening.filled), state });
      }
      await batch.commit();
      logActivity("Hiring", `${a.applicantName}: ${APPLICATION_STATUS[next].label} (${opening.title})`, a.id);
      toast(next === "hired" ? "Natanggap na! Na-update ang bilang ng bakante." : "Na-update.");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-gray-50 p-2"><p className="text-lg font-extrabold text-brand">{data.length}</p><p className="text-[0.68rem] text-gray-600">Nag-apply</p></div>
        <div className="rounded-xl bg-gray-50 p-2"><p className="text-lg font-extrabold text-emerald-700">{opening.filled} / {opening.slots}</p><p className="text-[0.68rem] text-gray-600">Natanggap</p></div>
        <div className="rounded-xl bg-gray-50 p-2"><p className="text-sm font-extrabold">{slotsLabel(opening)}</p><p className="text-[0.68rem] text-gray-600">Ngayon</p></div>
      </div>

      <FilterTabs
        label="Status ng aplikante"
        value={tab}
        onChange={setTab}
        options={(Object.keys(TAB_LABEL) as Tab[]).map((t) => ({ value: t, label: TAB_LABEL[t], count: count(t), tone: t === "new" ? "alert" : "neutral" }))}
      />

      {list.length === 0 ? (
        <EmptyState title={tab === "new" ? "Walang bagong aplikante" : "Wala dito"} />
      ) : (
        <div className="space-y-2.5">
          {list.map((a) => (
            <div key={a.id} className="space-y-2 rounded-2xl border border-gray-100 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold">
                    {a.applicantName} {a.verified && <span className="text-xs font-semibold text-blue-700">✓ Verified</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {a.purok || "—"}
                    {a.age !== null ? ` · ${a.age} taong gulang` : ""} · {timeAgo(a.createdAt)}
                  </p>
                </div>
                <Badge color={APPLICATION_STATUS[a.status].badge}>{APPLICATION_STATUS[a.status].label}</Badge>
              </div>
              {a.message ? <p className="rounded-xl bg-gray-50 p-2.5 text-[0.82rem] text-gray-700">“{a.message}”</p> : <p className="text-xs text-gray-400">Walang mensahe.</p>}
              {(a.education || a.experience) && (
                <div className="space-y-1 rounded-xl bg-gray-50 p-2.5 text-[0.82rem] text-gray-700">
                  {a.education && <p><b>Edukasyon:</b> {a.education}</p>}
                  {a.experience && <p><b>Karanasan:</b> {a.experience}</p>}
                </div>
              )}
              {(a.resumeFile || a.resumeLink) && (
                <div className="flex flex-wrap gap-1.5">
                  {a.resumeFile && (
                    <a href={a.resumeFile} download={a.resumeName || "resume"} className="flex items-center gap-1.5 rounded-xl bg-brand-light px-3 py-2 text-[0.8rem] font-bold text-brand-dark">
                      <Download className="h-4 w-4" aria-hidden /> <FileText className="h-4 w-4" aria-hidden /> {a.resumeName || "Resume"}
                    </a>
                  )}
                  {a.resumeLink && (
                    <a href={a.resumeLink} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1.5 rounded-xl bg-brand-light px-3 py-2 text-[0.8rem] font-bold text-brand-dark">
                      <ExternalLink className="h-4 w-4" aria-hidden /> Link ng resume
                    </a>
                  )}
                </div>
              )}
              {a.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {a.skills.map((s) => <span key={s} className="rounded-full bg-brand-light px-2.5 py-0.5 text-[0.7rem] font-bold text-brand">Skill: {s}</span>)}
                </div>
              )}
              <div className="grid grid-cols-3 gap-1.5">
                <a href={telHref(a.contact)} className="flex items-center justify-center gap-1 rounded-xl bg-brand-light py-2.5 text-[0.82rem] font-bold text-brand"><Phone className="h-4 w-4" /> Tawagan</a>
                {a.status === "hired" || a.status === "rejected" ? (
                  <Button variant="outline" className="col-span-2 !text-sm" loading={busy === a.id} onClick={() => setStatus(a, "new")}>Ibalik sa Bago</Button>
                ) : (
                  <>
                    <Button variant="soft" className="!px-2 !text-[0.82rem]" loading={busy === a.id} disabled={a.status === "interview"} onClick={() => setStatus(a, "interview")}>Interview</Button>
                    <Button className="!px-2 !text-[0.82rem]" loading={busy === a.id} disabled={opening.filled >= opening.slots} onClick={() => setStatus(a, "hired")}>Tanggapin</Button>
                  </>
                )}
              </div>
              {a.status !== "rejected" && a.status !== "hired" && (
                <button onClick={() => setStatus(a, "rejected")} className="w-full text-center text-xs font-semibold text-red-700">Hindi tanggapin</button>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-center text-xs text-gray-500">Kapag natanggap na ang lahat ng kailangan, awtomatikong magiging “Puno na” ang bakante.</p>
    </div>
  );
}
