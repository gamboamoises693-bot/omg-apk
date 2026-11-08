"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ensureUserDoc, useAuth } from "@/context/AuthContext";
import { usePuroks } from "@/lib/useSettings";
import { friendlyError } from "@/lib/format";
import { Button, Card, ErrorText, Input, Select } from "@/components/ui";
import { GoogleButton } from "@/components/GoogleButton";
import { useToast } from "@/components/Toast";
import { logActivity, setActivityActor } from "@/lib/activity";

const PH_MOBILE = /^(09|\+639)\d{9}$/;

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading: authLoading } = useAuth();
  const puroks = usePuroks();
  const [form, setForm] = useState({ fullName: "", purok: "", contact: "", email: "", password: "", birthday: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && user && !loading) router.replace("/account");
  }, [user, authLoading, loading, router]);

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const contact = form.contact.replace(/\s|-/g, "");
    if (form.fullName.trim().length < 3) return setError("Ilagay ang buong pangalan.");
    if (!form.purok) return setError("Pumili ng Purok.");
    if (!PH_MOBILE.test(contact)) return setError("Mali ang contact number. Halimbawa: 09171234567");
    if (form.password.length < 6) return setError("Ang password ay dapat 6 characters pataas.");

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      await updateProfile(cred.user, { displayName: form.fullName.trim() });
      await ensureUserDoc(cred.user, {
        fullName: form.fullName.trim(),
        purok: form.purok,
        contact,
        birthday: form.birthday,
      });
      setActivityActor({ uid: cred.user.uid, name: form.fullName.trim(), role: "resident" });
      logActivity("Account", `Nag-register (${form.purok})`, cred.user.uid);
      toast("Na-register ka na! Huling hakbang: selfie para ma-verify.");
      router.replace("/verify");
    } catch (err) {
      setError(friendlyError(err));
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-xl font-extrabold text-gray-900">Mag-register</h1>
      <p className="mb-4 text-gray-600">Para sa mga residente ng Barangay Malineng. Libre ito.</p>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Buong Pangalan" required autoComplete="name" placeholder="Juan Dela Cruz" value={form.fullName} onChange={update("fullName")} />
          <Select label="Purok" required options={puroks} placeholder="-- Pumili ng Purok --" value={form.purok} onChange={update("purok")} />
          <Input label="Contact Number" type="tel" inputMode="tel" required placeholder="09171234567" value={form.contact} onChange={update("contact")} />
          <Input label="Birthday" type="date" required value={form.birthday} onChange={update("birthday")} />
          <Input label="Email" type="email" required autoComplete="email" value={form.email} onChange={update("email")} />
          <Input label="Password" type="password" required autoComplete="new-password" hint="Hindi bababa sa 6 characters" value={form.password} onChange={update("password")} />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" full loading={loading}>Gumawa ng Account</Button>
        </form>
        <div className="my-4 flex items-center gap-3 text-sm text-gray-400">
          <span className="h-px flex-1 bg-gray-200" /> o kaya <span className="h-px flex-1 bg-gray-200" />
        </div>
        <GoogleButton onSuccess={() => router.replace("/account")} onError={setError} />
      </Card>
      <p className="mt-4 text-center">
        May account na?{" "}
        <Link href="/login" className="font-bold text-brand underline">Mag-login dito</Link>
      </p>
    </div>
  );
}
