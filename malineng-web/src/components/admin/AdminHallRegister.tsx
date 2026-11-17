"use client";

import { useRef, useState, type FormEvent } from "react";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { Camera, Copy, UserPlus } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { usePuroks } from "@/lib/useSettings";
import { logActivity } from "@/lib/activity";
import { friendlyError } from "@/lib/format";
import { compressToDataUrl } from "@/lib/upload";
import { makeFaceThumb } from "@/lib/faceThumb";
import { refreshPublicStatsQuietly } from "@/lib/stats";
import { verifiedSetAdd, verifiedSetRef } from "@/lib/verified";
import { PHONE_TAKEN_MESSAGE, claimPhoneInBatch, normalizePhone, phoneOwner } from "@/lib/phone";
import { CONTACT_EMAIL_DOMAIN } from "@/lib/phoneLogin";
import { Button, Card, ErrorText, Input, Select } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { createAuthUser, tempPassword } from "./AddAccountForm";

const SITE = "https://barangay-malineng.web.app";
type Done = { name: string; purok: string; login: string; password: string; verified: boolean };

/**
 * Kapitan, Secretary and the Developer register a resident who cannot do it alone (at the Barangay Hall).
 * No email needed: the mobile number is the login. When the staff saw the ID, the account is verified at once.
 */
export function AdminHallRegister() {
  const { user, profile, isAdmin, isSuperAdmin } = useAuth();
  const toast = useToast();
  const puroks = usePuroks();
  const [fullName, setFullName] = useState("");
  const [purok, setPurok] = useState("");
  const [birthday, setBirthday] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(tempPassword);
  const [idSeen, setIdSeen] = useState(true);
  const [selfie, setSelfie] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Same people the database rules allow (firestore.rules: canRegisterOthers).
  const allowed = isSuperAdmin || (isAdmin && ["Kapitan", "Secretary"].includes(profile?.position ?? ""));
  if (!allowed) return <p className="rounded-2xl bg-red-50 p-5 text-center font-semibold text-red-700">Kapitan, Secretary at Developer lang ang pwedeng mag-register ng residente.</p>;

  const pickSelfie = async (file?: File) => {
    if (!file) return;
    try {
      setSelfie(await compressToDataUrl(file, 600, 0.72));
      setError("");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const reset = () => {
    setFullName(""); setPurok(""); setBirthday(""); setContact(""); setEmail(""); setPassword(tempPassword()); setIdSeen(true); setSelfie(""); setDone(null); setError("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setError("");
    const name = fullName.trim();
    const phone = normalizePhone(contact);
    const realEmail = email.trim().toLowerCase();
    if (name.length < 2) return setError("Ilagay ang buong pangalan.");
    if (!purok) return setError("Piliin ang purok.");
    if (!phone) return setError("Mali ang contact number. Halimbawa: 09171234567");
    if (realEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(realEmail)) return setError("Mali ang format ng email.");
    if (password.length < 8) return setError("Dapat 8 characters pataas ang password.");
    setBusy(true);
    try {
      // Check the number BEFORE creating the login, so no orphan login is left behind.
      if ((await phoneOwner(phone, "")) !== "free") throw new Error(PHONE_TAKEN_MESSAGE);
      const authEmail = realEmail || `${phone}@${CONTACT_EMAIL_DOMAIN}`;
      const uid = await createAuthUser(authEmail, password);
      const faceThumb = selfie ? await makeFaceThumb(selfie).catch(() => "") : "";
      const batch = writeBatch(db);
      batch.set(doc(db, "users", uid), {
        uid,
        fullName: name,
        purok,
        contact: phone,
        birthday,
        email: realEmail,
        role: "resident",
        createdAt: serverTimestamp(),
        assistedBy: user.uid,
        assistedByName: profile.fullName,
        ...(faceThumb ? { faceThumb } : {}),
      });
      claimPhoneInBatch(batch, phone, uid);
      if (idSeen) {
        batch.set(doc(db, "verifiedUsers", uid), { name, verifiedAt: serverTimestamp(), verifiedBy: profile.fullName });
        batch.set(verifiedSetRef(), verifiedSetAdd(uid), { merge: true });
        if (selfie) {
          batch.set(doc(db, "verifications", uid), {
            uid, fullName: name, purok, birthday, contact: phone, email: realEmail, selfie, status: "verified", reason: "",
            reviewedBy: user.uid, reviewedByName: profile.fullName, reviewedAt: serverTimestamp(), submittedAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
      logActivity("Account", `Nag-register sa Hall: ${name} (${purok})${idSeen ? ", na-verify may ID" : ""}`, uid);
      refreshPublicStatsQuietly();
      toast("Nairehistro na ang residente.");
      setDone({ name, purok, login: realEmail || phone, password, verified: idSeen });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(code === "auth/email-already-in-use" ? "May account na ang number o email na ito. Hanapin sa Users at Roles." : friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const text = `Barangay Malineng website\n${SITE}\nLogin: ${done.login}\nPassword: ${done.password}\nPagkapasok, palitan ang password sa Account.`;
    return (
      <div className="space-y-3">
        <Card className="space-y-2">
          <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
            Nairehistro si <b>{done.name}</b> ({done.purok}). {done.verified ? "Verified na ang account." : "Hindi pa verified: kailangan pa ng selfie o pag-check ng ID."}
          </p>
          <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-sm">{text}</pre>
          <Button variant="soft" full onClick={() => navigator.clipboard?.writeText(text).then(() => toast("Nakopya. I-send sa kanya sa Messenger o text."), () => toast("Hindi makopya. Kopyahin nang mano-mano.", "error"))}>
            <Copy className="h-4 w-4" aria-hidden /> Kopyahin ang login details
          </Button>
          <p className="text-xs text-gray-500">Walang email ang account kung number ang ginamit, kaya hindi gagana ang "Nakalimutan ang password?". Sa Barangay Hall ang tulong.</p>
        </Card>
        <Button full onClick={reset}><UserPlus className="h-4 w-4" aria-hidden /> Mag-register ng iba</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="rounded-xl bg-brand-light px-3 py-2 text-sm text-brand-deep">Para sa residenteng hindi marunong mag-register. Ang contact number ang gagamitin niya sa login, kaya hindi na kailangan ng email.</p>
      <Card className="space-y-3">
        <Input label="Buong pangalan" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} required />
        <div className="grid grid-cols-2 gap-2">
          <Select label="Purok" options={puroks} placeholder="-- Pumili --" value={purok} onChange={(e) => setPurok(e.target.value)} required />
          <Input label="Birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
        </div>
        <Input label="Contact number (login niya ito)" type="tel" inputMode="tel" value={contact} onChange={(e) => setContact(e.target.value)} required hint="Isang numero = isang account" />
        <Input label="Pansamantalang password" value={password} onChange={(e) => setPassword(e.target.value)} hint="Ibigay sa kanya. Mapapalitan niya ito sa Account." required />
        <Input label="Email (optional)" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} hint="Kung meron siya, mas maganda: makakapag-reset siya ng password." />
        <label className="flex items-start gap-2 rounded-xl bg-gold-light p-3 text-sm">
          <input type="checkbox" checked={idSeen} onChange={(e) => setIdSeen(e.target.checked)} className="mt-1" />
          <span><b>Nakita ko ang ID niya</b><span className="block text-xs text-gray-700">Ma-ve-verify agad ang account at lalabas ang Barangay ID niya.</span></span>
        </label>
        {idSeen && (
          <div className="space-y-2">
            <input ref={fileInput} type="file" accept="image/*" capture="user" hidden onChange={(e) => pickSelfie(e.target.files?.[0])} />
            {selfie && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selfie} alt="Selfie ng residente" className="mx-auto h-40 w-32 rounded-2xl object-cover ring-2 ring-gold" />
            )}
            <Button type="button" variant="outline" full onClick={() => fileInput.current?.click()}>
              <Camera className="h-4 w-4" aria-hidden /> {selfie ? "Kunan ulit" : "Kunan ng selfie (para sa litrato sa ID)"}
            </Button>
          </div>
        )}
        <ErrorText>{error}</ErrorText>
        <Button type="submit" full loading={busy}>Irehistro</Button>
      </Card>
    </form>
  );
}
