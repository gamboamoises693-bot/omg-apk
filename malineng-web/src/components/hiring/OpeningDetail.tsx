"use client";

import { useEffect, useRef, useState } from "react";
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { CheckCircle2, ExternalLink, FileText, Phone, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useVerifiedSet } from "@/lib/useVerifiedSet";
import { logActivity } from "@/lib/activity";
import { ageFrom } from "@/lib/age";
import { friendlyError, telHref } from "@/lib/format";
import { APPLICATION_STATUS, applicationId, cleanUrl, deadlineLabel, isTakingApplications, openingPlace, slotsLabel, urlHost, type Application, type Opening } from "@/lib/hiring";
import { readResume, type ResumeFile } from "@/lib/resume";
import { Badge, Button, ErrorText, Input, Modal, Textarea } from "@/components/ui";
import { RequireVerified } from "@/components/RequireVerified";
import { Applicants } from "./Applicants";
import { useToast } from "@/components/Toast";

function ApplyBox({ o, mine }: { o: Opening; mine: Application | undefined }) {
  const { user, profile } = useAuth();
  const verified = useVerifiedSet();
  const toast = useToast();
  const [message, setMessage] = useState("");
  const [resume, setResume] = useState<ResumeFile | null>(null);
  const [resumeLink, setResumeLink] = useState("");
  const [education, setEducation] = useState("");
  const [experience, setExperience] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

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
    const link = cleanUrl(resumeLink);
    if (resumeLink.trim() && !link) return setError("Hindi tamang web address ang link ng resume.");
    if (o.resumeRequired && !resume && !link && !experience.trim()) return setError("Kailangan ng resume: magdagdag ng file, link, o isulat ang karanasan mo.");
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
        resumeFile: resume?.data ?? "",
        resumeName: resume?.name ?? "",
        resumeType: resume?.type ?? "",
        resumeLink: link,
        education: education.trim().slice(0, 400),
        experience: experience.trim().slice(0, 600),
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
        <div className="space-y-2 rounded-2xl border border-gray-200 p-3">
          <p className="text-[0.8rem] font-extrabold text-brand-dark">Resume {o.resumeRequired ? <span className="text-red-700">(kailangan)</span> : <span className="font-medium text-gray-500">(optional)</span>}</p>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setError("");
              try {
                setResume(await readResume(f));
              } catch (err) {
                setError(friendlyError(err));
              } finally {
                if (fileInput.current) fileInput.current.value = "";
              }
            }}
          />
          {resume ? (
            <div className="flex items-center gap-2 rounded-xl bg-brand-light px-3 py-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-brand" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-semibold">{resume.name}</span>
              <button type="button" aria-label="Alisin ang resume" onClick={() => setResume(null)}><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <Button type="button" variant="outline" full onClick={() => fileInput.current?.click()}>
              <FileText className="h-4 w-4" aria-hidden /> Magdagdag ng resume (PDF o larawan)
            </Button>
          )}
          <Input label="O link ng resume (Google Drive, LinkedIn)" type="url" inputMode="url" placeholder="https://..." value={resumeLink} onChange={(e) => setResumeLink(e.target.value)} maxLength={300} />
          <Textarea label="Edukasyon (optional)" placeholder="hal. BS Electronics, 2022" value={education} onChange={(e) => setEducation(e.target.value)} maxLength={400} />
          <Textarea label="Karanasan sa trabaho (optional)" placeholder="hal. 2 taon bilang production operator" value={experience} onChange={(e) => setExperience(e.target.value)} maxLength={600} />
          <p className="text-xs text-gray-500">Ang resume ay makikita lang ng employer at ng Barangay.</p>
        </div>
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
        <p className="text-sm text-gray-600">{o.employer}{openingPlace(o) ? ` · ${openingPlace(o)}` : ""}</p>
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
              {o.applyMode === "contact" && <p className="text-xs text-gray-500">Tawag o personal ang aplikasyon sa bakanteng ito.</p>}
              {o.applyMode === "link" && <p className="text-xs text-gray-500">Sa website ng kumpanya mag-a-apply ang mga tao, kaya wala itong listahan dito.</p>}
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
      ) : taking && o.applyMode === "link" && o.applyUrl ? (
        <div className="space-y-2">
          <a href={o.applyUrl} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-brand to-brand-dark py-3.5 font-bold text-white active:brightness-90">
            <ExternalLink className="h-5 w-5" aria-hidden /> Mag-apply sa {urlHost(o.applyUrl)}
          </a>
          <p className="text-center text-xs text-gray-500">Lalabas ka sa website na ito. Mag-ingat sa mga humihingi ng bayad para sa trabaho.</p>
        </div>
      ) : (
        taking && <p className="rounded-xl bg-gold-light p-3 text-sm text-yellow-900">Tumawag o pumunta sa employer para mag-apply.</p>
      )}
      {taking && !isOwner && o.applyMode === "website" && o.applyUrl && (
        <a href={o.applyUrl} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-[#C9D4E5] py-3 text-sm font-bold text-brand-dark active:bg-brand-light">
          <ExternalLink className="h-4 w-4" aria-hidden /> Bisitahin ang website: {urlHost(o.applyUrl)}
        </a>
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
