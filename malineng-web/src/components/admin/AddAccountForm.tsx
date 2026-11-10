"use client";

import { useState, type FormEvent } from "react";
import { deleteApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, inMemoryPersistence, initializeAuth, sendPasswordResetEmail, signOut } from "firebase/auth";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { Copy, Eye, EyeOff } from "lucide-react";
import { firebaseConfig } from "@/config/firebase.config";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { usePuroks } from "@/lib/useSettings";
import { logActivity, roleLabel } from "@/lib/activity";
import { ADMIN_POSITIONS } from "@/lib/constants";
import { friendlyError } from "@/lib/format";
import { refreshPublicStatsQuietly } from "@/lib/stats";
import { PHONE_TAKEN_MESSAGE, claimPhoneInBatch, normalizePhone, phoneOwner } from "@/lib/phone";
import { Button, ErrorText, Input, Select, SelectOther } from "@/components/ui";
import { useToast } from "@/components/Toast";

/** Readable temporary password, e.g. "Malineng-4827-kx". */
function tempPassword(): string {
  const n = crypto.getRandomValues(new Uint32Array(2));
  const letters = "abcdefghjkmnpqrstuvwxyz";
  return `Malineng-${1000 + (n[0] % 9000)}-${letters[n[1] % letters.length]}${letters[(n[1] >> 8) % letters.length]}`;
}

/**
 * Creating a user with the normal Firebase Auth instance would sign the Super Admin
 * out and sign in as the new user. A temporary, separate Firebase app with in-memory
 * auth creates the account without touching the Super Admin's session.
 */
async function createAuthUser(email: string, password: string): Promise<string> {
  const secondary = initializeApp(firebaseConfig, `create-${Date.now()}`);
  try {
    const secondaryAuth = initializeAuth(secondary, { persistence: inMemoryPersistence });
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await signOut(secondaryAuth);
    return cred.user.uid;
  } finally {
    await deleteApp(secondary).catch(() => undefined);
  }
}

type Done = { name: string; email: string; password: string; label: string };

/** Super Admin: create an account for an official (Kapitan, Secretary, BHW Head...) or a resident. */
export function AddAccountForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const puroks = usePuroks();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [purok, setPurok] = useState("");
  const [role, setRole] = useState<"admin" | "resident">("admin");
  const [position, setPosition] = useState<string>("Kapitan");
  const [password, setPassword] = useState(tempPassword);
  const [showPw, setShowPw] = useState(true);
  const [sendReset, setSendReset] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError("");
    const cleanEmail = email.trim().toLowerCase();
    if (!fullName.trim()) return setError("Ilagay ang buong pangalan.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return setError("Mali ang format ng email.");
    if (password.length < 6) return setError("Dapat 6 characters pataas ang password.");
    const phone = contact.trim() ? normalizePhone(contact) : "";
    if (contact.trim() && !phone) return setError("Mali ang contact number. Halimbawa: 09171234567");

    setBusy(true);
    try {
      // Check the number BEFORE creating the login, so no orphan login is left behind.
      if (phone && (await phoneOwner(phone, "")) !== "free") throw new Error(PHONE_TAKEN_MESSAGE);
      const uid = await createAuthUser(cleanEmail, password);
      // Profile doc + number claim written by the Super Admin (allowed by firestore.rules).
      const batch = writeBatch(db);
      batch.set(doc(db, "users", uid), {
        uid,
        fullName: fullName.trim(),
        email: cleanEmail,
        contact: phone,
        purok,
        birthday: "",
        role,
        position: role === "admin" ? position : "",
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
      if (phone) claimPhoneInBatch(batch, phone, uid);
      await batch.commit();
      if (sendReset) await sendPasswordResetEmail(auth, cleanEmail).catch(() => undefined);
      const label = roleLabel(role, role === "admin" ? position : "");
      logActivity("Roles", `Gumawa ng account para kay ${fullName.trim()} (${label})`, uid);
      refreshPublicStatsQuietly();
      toast("Nagawa ang account.");
      setDone({ name: fullName.trim(), email: cleanEmail, password, label });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(code === "auth/email-already-in-use" ? "May account na ang email na ito. Hanapin na lang sa listahan at palitan ang role." : friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const text = `Barangay Malineng website\nhttps://barangay-malineng.web.app\nEmail: ${done.email}\nPassword: ${done.password}\nPara magpalit ng password: sa Login, pindutin ang "Nakalimutan ang password?".`;
    return (
      <div className="space-y-3">
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
          Nagawa ang account ni <b>{done.name}</b> ({done.label}).
        </p>
        <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-xs">{text}</pre>
        <Button
          variant="soft"
          full
          onClick={() => navigator.clipboard?.writeText(text).then(() => toast("Nakopya. I-send sa kanya sa Messenger o text."), () => toast("Hindi makopya. Kopyahin nang mano-mano.", "error"))}
        >
          <Copy className="h-4 w-4" /> Kopyahin ang login details
        </Button>
        {sendReset && <p className="text-xs text-gray-500">Nagpadala rin ng email para makapagpalit siya ng sariling password.</p>}
        <Button full onClick={onDone}>Tapos na</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input label="Buong pangalan" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} required />
      <Input label="Email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <div className="grid grid-cols-2 gap-2">
        <Select label="Role" options={["Admin", "Residente"]} value={role === "admin" ? "Admin" : "Residente"} onChange={(e) => setRole(e.target.value === "Admin" ? "admin" : "resident")} />
        {role === "admin" ? (
          <SelectOther label="Position" options={ADMIN_POSITIONS} value={position} onChange={setPosition} maxLength={40} />
        ) : (
          <span />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input label="Contact" type="tel" inputMode="tel" placeholder="09xx..." value={contact} onChange={(e) => setContact(e.target.value)} />
        <Select label="Purok" options={puroks} placeholder="Piliin" value={purok} onChange={(e) => setPurok(e.target.value)} />
      </div>
      <div>
        <span className="mb-1 block text-[0.85rem] font-semibold text-gray-700">Pansamantalang password</span>
        <div className="flex gap-2">
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2.5 font-mono"
            aria-label="Pansamantalang password"
          />
          <button type="button" onClick={() => setShowPw((v) => !v)} className="rounded-xl border border-gray-200 px-3" aria-label={showPw ? "Itago ang password" : "Ipakita ang password"}>
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <label className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-sm">
        <input type="checkbox" checked={sendReset} onChange={(e) => setSendReset(e.target.checked)} className="mt-0.5 h-5 w-5 accent-brand" />
        Padalhan siya ng email para makagawa ng sariling password
      </label>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" full loading={busy}>Gawin ang account</Button>
    </form>
  );
}
