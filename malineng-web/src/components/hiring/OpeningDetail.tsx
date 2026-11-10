"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { CheckCircle2, Phone } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useVerifiedSet } from "@/lib/useVerifiedSet";
import { logActivity } from "@/lib/activity";
import { ageFrom } from "@/lib/age";
import { friendlyError, telHref } from "@/lib/format";
import { APPLICATION_STATUS, applicationId, deadlineLabel, isTakingApplications, slotsLabel, type Application, type Opening } from "@/lib/hiring";
import { Badge, Button, ErrorText, Modal, Textarea } from "@/components/ui";
import { RequireVerified } from "@/components/RequireVerified";
import { Applicants } from "./Applicants";
import { useToast } from "@/components/Toast";

function ApplyBox({ o, mine }: { o: Opening; mine: Application | undefined }) {
  const { user, profile } = useAuth();
  const verified = useVerifiedSet();
  const toast = useToast();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (mine) {
    const st = APPLICATION_STATUS[mine.status];
    return (
      <div className="space-y-2 rounded-2xl bg-brand-light p-3 text-sm">
        <p className="flex items-center gap-2 font-bold text-brand-deep"><CheckCircle2 className="h-5 w-5" /> Nakapag-apply ka na <Badge color={st.badge}>{st.label}</Badge></p>
        {mine.status === "hired" && <p>Congratulations! Tawagan ang employer para sa susunod na hakbang.</p>}
        {mine.status === "new" && (
          <button
            className="text-xs font-semibold text-red-700 underline"
            onClick={async () => {
              if (!confirm("Bawiin ang aplikasyon mo?")) return;
              try {
                await deleteDoc(doc(db, "applications", mine.id));
                logActivity("Hiring", `Binawi ang aplikasyon: ${o.title}`, mine.id);
                toast("Nabawi ang aplikasyon.");
              } catch (err) {
                toast(friendlyError(err), "error");
              }
            }}
          >
            Bawiin ang aplikasyon
          </button>
        )}
      </div>
    );
  }

  const apply = async () => {
    if (!user || !profile) return;
    setError("");
    setBusy(true);
    try {
      // Skills the person already listed in the Skills Directory go along with the application.
      const skillsSnap = await getDocs(query(collection(db, "skills"), where("userId", "==", user.uid)));
      const skills = [...new Set(skillsSnap.docs.map((d) => String(d.data().skill ?? "")).filter(Boolean))].slice(0, 10);
      const data = {
        openingId: o.id,
        openingTitle: o.title,
        employerId: o.posterId,
        applicantId: user.uid,
        applicantName: profile.fullName,
        purok: profile.purok ?? "",
        contact: profile.contact ?? "",
        age: ageFrom(profile.birthday ?? ""),
        verified: verified.has(user.uid) || profile.role !== "resident",
        skills,
        message: message.trim().slice(0, 500),
        status: "new",
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "applications", applicationId(o.id, user.uid)), data);
      logActivity("Hiring", `Nag-apply: ${o.title} (${o.employer})`, o.id);
      toast("Naipadala ang aplikasyon mo!");
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(code === "permission-denied" ? "Hindi na tumatanggap ng aplikasyon ang bakanteng ito, o hindi pa verified ang account mo." : friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <RequireVerified feature="mag-apply sa trabaho">
      <div className="space-y-2">
        <p className="rounded-xl bg-brand-light p-2.5 text-xs text-brand-deep">Ang <b>pangalan, purok, contact at skills mo</b> ay awtomatikong ipapadala sa employer. Siya at ang Barangay lang ang makakakita.</p>
        <Textarea label="Mensahe sa employer (optional)" placeholder="hal. May 2 taon po akong karanasan. Pwede po ako agad." value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} />
        <ErrorText>{error}</ErrorText>
        <Button full loading={busy} onClick={apply}>Mag-apply ngayon</Button>
      </div>
    </RequireVerified>
  );
}

/** Opening details with Apply (everyone else) or Mga nag-apply / Isara (the poster). */
export function OpeningDetail({ o, mine, onClosed }: { o: Opening; mine: Application | undefined; onClosed: () => void }) {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const [showApplicants, setShowApplicants] = useState(false);
  const isOwner = !!user && o.posterId === user.uid;
  const taking = isTakingApplications(o);

  useEffect(() => setShowApplicants(false), [o.id]);

  const setState = async (state: "open" | "closed") => {
    try {
      await updateDoc(doc(db, "openings", o.id), { state: state === "open" && o.filled >= o.slots ? "full" : state });
      logActivity("Hiring", `${state === "closed" ? "Isinara" : "Binuksan ulit"} ang bakante: ${o.title}`, o.id);
      toast(state === "closed" ? "Naisara ang bakante." : "Bukas ulit ang bakante.");
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const remove = async () => {
    if (!confirm(`Burahin ang bakanteng “${o.title}”?`)) return;
    try {
      await deleteDoc(doc(db, "openings", o.id));
      logActivity("Hiring", `Binura ang bakante: ${o.title}`, o.id);
      onClosed();
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {o.official && <Badge color="blue">OPISYAL · BARANGAY</Badge>}
        {taking ? <Badge color="green">BUKAS · {slotsLabel(o)}</Badge> : <Badge color="gray">{o.state === "closed" ? "Sarado" : o.filled >= o.slots ? "Puno na" : "Tapos na ang deadline"}</Badge>}
        {o.status === "pending" && <Badge color="gold">Naghihintay ng approval</Badge>}
        {o.status === "rejected" && <Badge color="red">Hindi naaprubahan</Badge>}
      </div>
      <div>
        <p className="text-xl font-extrabold leading-tight">{o.title}</p>
        <p className="text-sm text-gray-600">{o.employer}{o.purok ? ` · ${o.purok}` : ""}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-gray-50 p-2"><p className="text-sm font-extrabold">{o.slots}</p><p className="text-[0.68rem] text-gray-600">Kailangan</p></div>
        <div className="rounded-xl bg-gray-50 p-2"><p className="text-sm font-extrabold">{o.salary || "—"}</p><p className="text-[0.68rem] text-gray-600">Sahod</p></div>
        <div className="rounded-xl bg-gray-50 p-2"><p className="text-sm font-extrabold">{o.type}</p><p className="text-[0.68rem] text-gray-600">{deadlineLabel(o.deadline)}</p></div>
      </div>
      {o.requirements.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Kailangan</p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-700">{o.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      {o.details && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Oras at benepisyo</p>
          <p className="whitespace-pre-line text-sm text-gray-700">{o.details}</p>
        </div>
      )}

      {isOwner ? (
        <div className="space-y-2">
          {o.status === "approved" && (
            <>
              <Button full onClick={() => setShowApplicants(true)} disabled={o.applyMode !== "website"}>Tingnan ang mga nag-apply</Button>
              {o.applyMode !== "website" && <p className="text-xs text-gray-500">Tawag o personal ang aplikasyon sa bakanteng ito.</p>}
              <div className="grid grid-cols-2 gap-2">
                {o.state === "closed" ? <Button variant="outline" onClick={() => setState("open")}>Buksan ulit</Button> : <Button variant="outline" onClick={() => setState("closed")}>Isara ang bakante</Button>}
                <Button variant="outline" className="!text-red-700" onClick={remove}>Burahin</Button>
              </div>
            </>
          )}
          {o.status !== "approved" && <Button variant="outline" full className="!text-red-700" onClick={remove}>Burahin</Button>}
        </div>
      ) : taking && o.applyMode === "website" ? (
        <ApplyBox o={o} mine={mine} />
      ) : (
        taking && <p className="rounded-xl bg-gold-light p-3 text-sm text-yellow-900">Tumawag o pumunta sa employer para mag-apply.</p>
      )}

      {!isOwner && mine && !taking && <ApplyBoxStatus mine={mine} />}
      {(taking || isOwner || isAdmin) && o.contact && (
        <a href={telHref(o.contact)} className="flex items-center justify-center gap-2 rounded-xl bg-brand-light py-3 font-bold text-brand">
          <Phone className="h-5 w-5" /> Tawagan: {o.contact}
        </a>
      )}

      <Modal open={showApplicants} onClose={() => setShowApplicants(false)} title={`Nag-apply: ${o.title}`}>
        {showApplicants && <Applicants opening={o} />}
      </Modal>
    </div>
  );
}

function ApplyBoxStatus({ mine }: { mine: Application }) {
  const st = APPLICATION_STATUS[mine.status];
  return <p className="flex items-center gap-2 rounded-xl bg-gray-50 p-3 text-sm">Aplikasyon mo: <Badge color={st.badge}>{st.label}</Badge></p>;
}
