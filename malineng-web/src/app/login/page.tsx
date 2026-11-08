"use client";

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
    if (!authLoading && user) router.replace("/account");
  }, [user, authLoading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      toast("Welcome back!");
      router.replace("/");
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
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast("Nag-send kami ng password reset link sa email mo.");
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-xl font-extrabold text-gray-900">Mag-login</h1>
      <p className="mb-4 text-gray-600">Para makapag-post, makapagbenta at makapag-book ng appointment.</p>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
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
        <GoogleButton onSuccess={() => router.replace("/account")} onError={setError} />
      </Card>
      <p className="mt-4 text-center">
        Wala pang account?{" "}
        <Link href="/register" className="font-bold text-brand underline">Mag-register dito</Link>
      </p>
    </div>
  );
}
