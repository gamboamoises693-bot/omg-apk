"use client";

import { AuthHero } from "@/components/AuthHero";
import { SiteFooter } from "@/components/SiteFooter";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { friendlyError } from "@/lib/format";
import { Button, Card, ErrorText, Input } from "@/components/ui";
import { GoogleButton } from "@/components/GoogleButton";
import { useToast } from "@/components/Toast";
import { nextFromLocation } from "@/lib/nextPath";
import { markFreshLogin } from "@/lib/officerLanding";
import { loginIdFor } from "@/lib/phoneLogin";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Already logged in -> go to account.
  useEffect(() => {
    if (!authLoading && user) router.replace(nextFromLocation() || "/account");
  }, [user, authLoading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginIdFor(email), password);
      toast("Welcome back!");
      const next = nextFromLocation();
      // No page asked for a redirect: officers land on the Dashboard (see OfficerLanding).
      if (!next) markFreshLogin();
      router.replace(next || "/");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) {
      setError("Ilagay muna ang email mo sa itaas.");
      return;
    }
    // A contact-number account has no mailbox, so there is nothing to send to.
    if (!email.includes("@")) {
      setError("Walang email ang account na ito. Pumunta sa Barangay Hall para mapalitan ang password.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast("Nag-send kami ng password reset link sa email mo.");
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <AuthHero title="Mag-login" subtitle="Para makapag-post, makapagbenta at makapag-book ng appointment." />
      <Card className="relative -mt-10">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Email o contact number" type="text" inputMode="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} hint="Walang email? Ilagay ang contact number na ginamit sa Barangay Hall." />
          <Input label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" full loading={loading}>Mag-login</Button>
          <button type="button" onClick={handleReset} className="w-full text-center text-sm font-semibold text-brand underline">
            Nakalimutan ang password?
          </button>
        </form>
        <div className="my-4 flex items-center gap-3 text-sm text-gray-400">
          <span className="h-px flex-1 bg-gray-200" /> o kaya <span className="h-px flex-1 bg-gray-200" />
        </div>
        <GoogleButton onSuccess={() => { markFreshLogin(); router.replace("/account"); }} onError={setError} />
      </Card>
      <p className="mt-4 text-center">
        Wala pang account?{" "}
        <Link href="/register" className="font-bold text-brand underline">Mag-register dito</Link>
      </p>
      <p className="mt-3 text-center text-sm text-gray-600">Hindi makapag-login o mag-register? Pumunta sa Barangay Hall, o kung nakapag-register ka na, mag-login at pindutin ang <b>Nahihirapan sa pag-setup?</b> sa Account para makipag-chat sa mga admin.</p>
      <SiteFooter className="mt-10" />
    </div>
  );
}
