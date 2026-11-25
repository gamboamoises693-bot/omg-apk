"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { Loader2, Lock, Mail } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { friendlyError } from "@/lib/format";
import { markFreshLogin } from "@/lib/officerLanding";
import { loginIdFor } from "@/lib/phoneLogin";

/**
 * Developer login: the futuristic glass sign-in, meant for the Developer (Super Admin) only.
 * It has no link from the public site; the regular /login stays unchanged for residents.
 * It uses the same Firebase sign-in, so nothing here grants access by itself.
 */
export default function DevLoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // Already signed in: go straight in (the Dashboard opens for officers, see OfficerLanding).
  useEffect(() => {
    if (!authLoading && user) router.replace("/");
  }, [user, authLoading, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, loginIdFor(email), password);
      markFreshLogin();
      router.replace("/");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setError("");
    setInfo("");
    if (!email.includes("@")) {
      setError("Ilagay muna ang email mo sa itaas.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo("Naipadala ang password reset link sa email mo.");
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  return (
    // Covers the site header and bottom bar: this screen stands alone. Admin-style screens stay in one language.
    <main data-no-i18n className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#070b16] px-4 py-8">
      {/* Glow blobs behind the card */}
      <div aria-hidden className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-indigo-600/30 blur-[110px]" />
      <div aria-hidden className="pointer-events-none absolute -right-24 bottom-1/4 h-72 w-72 rounded-full bg-cyan-500/25 blur-[110px]" />

      {/* Orbit lines */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-40" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
        <ellipse cx="200" cy="400" rx="190" ry="300" fill="none" stroke="rgba(139,120,255,.35)" strokeWidth="1" />
        <ellipse cx="200" cy="400" rx="150" ry="360" fill="none" stroke="rgba(61,225,255,.2)" strokeWidth="1" transform="rotate(25 200 400)" />
      </svg>

      {/* Stars */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20% 30%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 70% 20%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 85% 65%, #9fe 50%, transparent 51%), radial-gradient(1px 1px at 35% 80%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 55% 55%, #fff 50%, transparent 51%)",
        }}
      />

      <form onSubmit={submit} className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-[0_20px_60px_-15px_rgba(0,0,0,.8)] backdrop-blur-xl">
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/10 via-transparent to-transparent" />

        <p className="relative text-[0.7rem] font-bold uppercase tracking-[0.2em] text-cyan-200/80">Barangay Malineng</p>
        <h1 className="relative mt-1 text-3xl font-extrabold uppercase leading-tight tracking-wide text-white">
          Welcome<br />Back
        </h1>
        <p className="relative mt-1 text-sm text-white/60">Developer login</p>

        <div className="relative mt-6 space-y-4">
          <Field icon={<Mail className="h-5 w-5" aria-hidden />}>
            <input
              type="text"
              inputMode="email"
              required
              autoComplete="username"
              aria-label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-transparent text-white outline-none placeholder:text-white/50"
            />
          </Field>
          <Field icon={<Lock className="h-5 w-5" aria-hidden />}>
            <input
              type="password"
              required
              autoComplete="current-password"
              aria-label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-transparent text-white outline-none placeholder:text-white/50"
            />
          </Field>
        </div>

        {error && <p role="alert" className="relative mt-3 text-sm text-red-300">{error}</p>}
        {info && <p role="status" className="relative mt-3 text-sm text-emerald-300">{info}</p>}

        <button
          type="submit"
          disabled={busy}
          className="relative mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-300 font-bold uppercase tracking-wider text-[#04101f] shadow-[0_8px_30px_-6px_rgba(56,189,248,.7)] transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Sign in
        </button>

        <button type="button" onClick={reset} className="relative mt-4 w-full min-h-10 text-center text-sm text-white/70 underline underline-offset-4">
          Forgot password?
        </button>
      </form>
    </main>
  );
}

/** Input wrapper: the glowing gradient border shows while the input inside has focus. */
function Field({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/15 bg-black/20 px-3.5 text-white/70 transition focus-within:border-cyan-300/80 focus-within:text-cyan-200 focus-within:shadow-[0_0_0_1px_rgba(139,120,255,.6),0_0_22px_rgba(61,225,255,.35)]">
      {icon}
      {children}
    </label>
  );
}
