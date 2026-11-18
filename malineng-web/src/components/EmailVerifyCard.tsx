"use client";

import { isContactEmail } from "@/lib/phoneLogin";
import { useEffect, useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { MailCheck, X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { friendlyError } from "@/lib/format";
import { Button, ErrorText } from "./ui";

/** True for email-and-password accounts whose email is not confirmed yet (Google accounts are always confirmed). */
export function needsEmailConfirm(user: { emailVerified: boolean; email?: string | null; providerData: { providerId: string }[] } | null): boolean {
  // An account made at the Barangay Hall with a mobile number has no real mailbox to confirm.
  return !!user && !user.emailVerified && !isContactEmail(user.email) && user.providerData.some((p) => p.providerId === "password");
}

/**
 * Explains the confirmation email, resends it, and checks again once the person tapped the link.
 * After a successful check the page reloads so the database sees the confirmed email.
 */
export function EmailVerifyCard({ compact = false, optional = false }: { compact?: boolean; optional?: boolean }) {
  const [busy, setBusy] = useState<"send" | "check" | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const email = auth.currentUser?.email ?? "";

  const resend = async () => {
    if (!auth.currentUser) return;
    setBusy("send");
    setError("");
    try {
      await sendEmailVerification(auth.currentUser);
      setMsg("Naipadala ang email. Tingnan ang Inbox at ang Spam folder.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  };

  const check = async () => {
    const u = auth.currentUser;
    if (!u) return;
    setBusy("check");
    setError("");
    try {
      await u.reload();
      if (u.emailVerified) {
        await u.getIdToken(true); // new token so the rules see the confirmed email
        window.location.reload();
        return;
      }
      setMsg("Hindi pa nakukumpirma. Pindutin muna ang link sa email, saka subukan ulit.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`rounded-2xl bg-gold-light text-yellow-900 ${compact ? "p-3 text-sm" : "p-4"}`}>
      <p className="flex items-start gap-2 font-bold">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <span>{optional ? "Pwede mo ring kumpirmahin ang email mo" : "Kumpirmahin ang email mo"}{email ? ` (${email})` : ""}.</span>
      </p>
      <p className={`mt-1 ${compact ? "text-xs" : "text-sm"}`}>
        {optional
          ? "Hindi ito hadlang sa selfie. Makakatulong ito para makapag-reset ka ng password. Kung hindi dumating ang email, tingnan ang Spam folder, o pindutin ang Ipadala ulit."
          : "Pindutin ang link sa ipinadalang email. Makakatulong ito sa pag-reset ng password. Hindi ito hadlang sa selfie."}
      </p>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <Button variant="outline" className="!min-h-0 !py-2 !text-sm" loading={busy === "send"} onClick={resend}>Ipadala ulit</Button>
        <Button className="!min-h-0 !py-2 !text-sm" loading={busy === "check"} onClick={check}>Na-kumpirma ko na</Button>
      </div>
      {msg && <p className="mt-2 text-xs font-semibold">{msg}</p>}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

/** Slim version shown under the top bar on every page while the email is unconfirmed. */
export function EmailVerifyBanner({ user, isStaff }: { user: Parameters<typeof needsEmailConfirm>[0]; isStaff: boolean }) {
  // A reminder only: it can be closed, and it does not block anything (the selfie goes first).
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem("malineng-email-reminder") === "off");
    } catch {
      setHidden(false);
    }
  }, []);
  if (isStaff || hidden || !needsEmailConfirm(user)) return null;
  return (
    <div className="no-print relative mx-auto max-w-3xl px-4 pt-3">
      <EmailVerifyCard compact optional />
      <button
        type="button"
        aria-label="Isara ang paalala"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem("malineng-email-reminder", "off");
          } catch {
            /* private mode: it shows again next time */
          }
        }}
        className="absolute right-6 top-5 rounded-full p-1 text-yellow-900 active:bg-yellow-200"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
