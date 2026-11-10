"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { usePuroks } from "@/lib/useSettings";
import { logActivity } from "@/lib/activity";
import { friendlyError, todayISO } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import { OPENING_TYPES } from "@/lib/hiring";
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
  const [applyMode, setApplyMode] = useState<"website" | "contact">("website");
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
    if (!phone) return setError("Ilagay ang contact number.");
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
      <Input label="Negosyo / Employer" placeholder="hal. Malineng Mini Mart" value={employer} onChange={(e) => setEmployer(e.target.value)} maxLength={80} />
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
        <Select label="Purok / Lugar" options={puroks} placeholder="Piliin" value={purok} onChange={(e) => setPurok(e.target.value)} />
        <Input label="Contact" type="tel" inputMode="tel" value={contact} onChange={(e) => setContact(e.target.value)} />
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-[0.85rem] font-semibold text-gray-700">Paano mag-apply</legend>
        <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${applyMode === "website" ? "border-2 border-brand bg-brand-light" : "border-gray-200"}`}>
          <input type="radio" name="apply" checked={applyMode === "website"} onChange={() => setApplyMode("website")} className="h-4 w-4 accent-brand" />
          Sa website (makikita ko ang listahan ng nag-apply)
        </label>
        <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${applyMode === "contact" ? "border-2 border-brand bg-brand-light" : "border-gray-200"}`}>
          <input type="radio" name="apply" checked={applyMode === "contact"} onChange={() => setApplyMode("contact")} className="h-4 w-4 accent-brand" />
          Tumawag o pumunta lang sa amin
        </label>
      </fieldset>
      <ErrorText>{error}</ErrorText>
      <Button full loading={busy} onClick={submit}>{isOfficer ? "I-post ngayon" : "Ipadala para i-approve"}</Button>
    </div>
  );
}
