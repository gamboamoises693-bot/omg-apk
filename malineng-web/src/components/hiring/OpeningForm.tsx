"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { usePuroks } from "@/lib/useSettings";
import { logActivity } from "@/lib/activity";
import { friendlyError, todayISO } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import { OPENING_TYPES, cleanUrl } from "@/lib/hiring";
import { Button, ErrorText, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";

/** Post a job opening. Residents wait for approval; Kapitan, Secretary and Super Admin publish OPISYAL openings directly. */
export function OpeningForm({ onDone }: { onDone: () => void }) {
  const { user, profile, isOfficer } = useAuth();
  const puroks = usePuroks();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [employer, setEmployer] = useState(isOfficer ? "Barangay Malineng" : "");
  const [slots, setSlots] = useState("1");
  const [type, setType] = useState<string>(OPENING_TYPES[0]);
  const [salary, setSalary] = useState("");
  const [deadline, setDeadline] = useState("");
  const [requirements, setRequirements] = useState("");
  const [details, setDetails] = useState("");
  const [purok, setPurok] = useState(profile?.purok ?? "");
  const [contact, setContact] = useState(profile?.contact ?? "");
  const [applyMode, setApplyMode] = useState<"website" | "contact" | "link">("website");
  const [location, setLocation] = useState("");
  const [applyUrl, setApplyUrl] = useState("");
  const [resumeRequired, setResumeRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!user || !profile) return;
    setError("");
    const n = Math.floor(Number(slots));
    const phone = normalizePhone(contact) || contact.trim().slice(0, 30);
    if (!title.trim()) return setError("Ilagay ang posisyon.");
    if (!employer.trim()) return setError("Ilagay ang pangalan ng negosyo o employer.");
    if (!(n >= 1 && n <= 500)) return setError("Ilagay kung ilan ang kailangan (1 pataas).");
    if (applyMode === "contact" && !phone) return setError("Ilagay ang contact number para sa tawag o pagpunta.");
    const url = cleanUrl(applyUrl);
    if (applyUrl.trim() && !url) return setError("Hindi tamang web address ang link (hal. sfasemicon.com/careers).");
    if (applyMode === "link" && !url) return setError("Ilagay ang link ng website kung saan mag-a-apply.");
    if (deadline && deadline < todayISO()) return setError("Nakalipas na ang deadline.");

    const reqs = requirements.split("\n").map((r) => r.trim().slice(0, 100)).filter(Boolean).slice(0, 10);
    setBusy(true);
    try {
      const data = {
        posterId: user.uid,
        posterName: profile.fullName,
        employer: employer.trim().slice(0, 80),
        title: title.trim().slice(0, 120),
        slots: n,
        filled: 0,
        type,
        salary: salary.trim().slice(0, 60),
        deadline,
        requirements: reqs,
        details: details.trim().slice(0, 500),
        purok,
        contact: phone,
        location: location.trim().slice(0, 100),
        applyUrl: url,
        resumeRequired: applyMode === "website" && resumeRequired,
        applyMode,
        official: isOfficer,
        status: isOfficer ? "approved" : "pending",
        state: "open",
        createdAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, "openings"), data);
      logActivity("Hiring", `Nag-post ng bakante: “${data.title}” (${data.employer})`, ref.id);
      if (isOfficer) {
        // Official openings also go out as a Pabatid so everyone sees them.
        await addDoc(collection(db, "announcements"), {
          title: `Bagong bakante: ${data.title}`,
          body: `${data.employer}${data.salary ? ` · ${data.salary}` : ""}. ${n} ang kailangan. Tingnan sa Hiring page.`,
          category: "Abiso",
          puroks: [],
          createdAt: serverTimestamp(),
          createdByName: profile.fullName,
        }).catch((err) => console.warn("[hiring] pabatid failed:", err));
        toast("Naka-post na ang bakante at naipadala sa Pabatid.");
      } else {
        toast("Naipadala! Lalabas ito kapag na-approve ng Barangay.");
      }
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {isOfficer && <p className="rounded-xl bg-brand-light p-2.5 text-xs font-semibold text-brand-deep">Lalabas ito bilang OPISYAL na bakante ng Barangay at agad na ipapadala sa Pabatid.</p>}
      <Input label="Posisyon" placeholder="hal. Cashier / Sales Clerk" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      <Input label="Kumpanya / Employer" placeholder="hal. SFA Semicon o Malineng Mini Mart" value={employer} onChange={(e) => setEmployer(e.target.value)} maxLength={80} />
      <Input label="Saan ang trabaho" placeholder="hal. Cavite, Cuyapo, o Online" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} hint="Pwede kahit saan: kumpanya, pabrika o opisina, hindi lang sa Malineng." />
      <div className="grid grid-cols-2 gap-2">
        <Input label="Ilan ang kailangan" type="number" inputMode="numeric" min={1} value={slots} onChange={(e) => setSlots(e.target.value)} />
        <Select label="Uri" options={OPENING_TYPES} value={type} onChange={(e) => setType(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input label="Sahod" placeholder="hal. ₱500/araw" value={salary} onChange={(e) => setSalary(e.target.value)} maxLength={60} />
        <Input label="Deadline" type="date" min={todayISO()} value={deadline} onChange={(e) => setDeadline(e.target.value)} hint="Optional" />
      </div>
      <Textarea label="Kailangan (isa kada linya)" placeholder={"18 taong gulang pataas\nNakatapos ng high school"} value={requirements} onChange={(e) => setRequirements(e.target.value)} />
      <Textarea label="Oras, benepisyo at iba pa (optional)" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} />
      <div className="grid grid-cols-2 gap-2">
        <Select label="Purok (kung taga-Malineng)" options={puroks} placeholder="Wala" value={purok} onChange={(e) => setPurok(e.target.value)} />
        <Input label={applyMode === "contact" ? "Contact" : "Contact (optional)"} type="tel" inputMode="tel" value={contact} onChange={(e) => setContact(e.target.value)} />
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-[0.8rem] font-bold text-brand-dark">Paano mag-apply</legend>
        {(
          [
            ["website", "Sa website na ito", "Magpapadala sila ng resume rito at makikita mo ang listahan ng nag-apply."],
            ["link", "Sa website ng kumpanya", "Ilalagay mo ang link at doon sila mag-a-apply."],
            ["contact", "Tumawag o pumunta lang", "Walang aplikasyon dito."],
          ] as const
        ).map(([value, label, hint]) => (
          <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${applyMode === value ? "border-2 border-brand bg-brand-light" : "border-gray-200"}`}>
            <input type="radio" name="apply" checked={applyMode === value} onChange={() => setApplyMode(value)} className="mt-0.5 h-4 w-4 accent-brand" />
            <span>
              <b className="block">{label}</b>
              <span className="text-xs text-gray-600">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {(applyMode === "link" || applyMode === "website") && (
        <Input
          label={applyMode === "link" ? "Link ng website para mag-apply" : "Link ng website ng kumpanya (optional)"}
          type="url"
          inputMode="url"
          placeholder="hal. sfasemicon.com/careers"
          value={applyUrl}
          onChange={(e) => setApplyUrl(e.target.value)}
          maxLength={300}
        />
      )}
      {applyMode === "website" && (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm">
          <input type="checkbox" checked={resumeRequired} onChange={(e) => setResumeRequired(e.target.checked)} className="h-4 w-4 accent-brand" />
          <span><b>Kailangan ng resume</b> <span className="text-xs text-gray-600">(file, link o isinulat na karanasan)</span></span>
        </label>
      )}
      {!isOfficer && <p className="rounded-xl bg-gold-light p-2.5 text-xs text-yellow-900">Sinusuri ng Barangay ang bawat bakante at ang link bago ito lumabas.</p>}
      <ErrorText>{error}</ErrorText>
      <Button full loading={busy} onClick={submit}>{isOfficer ? "I-post ngayon" : "Ipadala para i-approve"}</Button>
    </div>
  );
}
