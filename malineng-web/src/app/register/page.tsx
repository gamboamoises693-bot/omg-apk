"use client";

import { CIVIL_STATUS_OPTIONS, SEX_OPTIONS } from "@/lib/constants";
import { AuthHero } from "@/components/AuthHero";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from "firebase/auth";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { SelfieCapture, SelfieReview } from "@/components/SelfieCapture";
import { makeFaceThumb } from "@/lib/faceThumb";
import { ensureUserDoc, useAuth } from "@/context/AuthContext";
import { PHONE_TAKEN_MESSAGE, normalizePhone } from "@/lib/phone";
import { usePuroks } from "@/lib/useSettings";
import { friendlyError } from "@/lib/format";
import { Button, Card, ErrorText, Input, Select } from "@/components/ui";
import { GoogleButton } from "@/components/GoogleButton";
import { useToast } from "@/components/Toast";
import { logActivity, setActivityActor } from "@/lib/activity";


export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading: authLoading } = useAuth();
  const puroks = usePuroks();
  const [form, setForm] = useState({ fullName: "", purok: "", contact: "", email: "", password: "", birthday: "", sex: "", civilStatus: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Selfie first (kept on the phone until the account exists), then the details.
  const [step, setStep] = useState<"selfie" | "details">("selfie");
  const [selfie, setSelfie] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user && !loading) router.replace("/account");
  }, [user, authLoading, loading, router]);

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const contact = normalizePhone(form.contact);
    if (form.fullName.trim().length < 3) return setError("Ilagay ang buong pangalan.");
    if (!form.purok) return setError("Pumili ng Purok.");
    if (!contact) return setError("Mali ang contact number. Halimbawa: 09171234567");
    if (form.password.length < 8) return setError("Ang password ay dapat 8 characters pataas.");

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      await updateProfile(cred.user, { displayName: form.fullName.trim() });
      // The confirmation email is needed before posting or sending the selfie; failing to send it must not stop registering.
      sendEmailVerification(cred.user).catch((err) => console.warn("[register] verification email failed:", err));
      try {
        await ensureUserDoc(cred.user, {
          fullName: form.fullName.trim(),
          purok: form.purok,
          contact,
          birthday: form.birthday,
          sex: form.sex,
          civilStatus: form.civilStatus,
        });
      } catch (profileErr) {
        // Number already used: undo the login we just made so this email can register again.
        if (profileErr instanceof Error && profileErr.message === PHONE_TAKEN_MESSAGE) await cred.user.delete().catch(() => undefined);
        throw profileErr;
      }
      setActivityActor({ uid: cred.user.uid, name: form.fullName.trim(), role: "resident" });
      logActivity("Account", `Nag-register (${form.purok})`, cred.user.uid);
      // The selfie taken at the start goes to the Barangay right away (with the ID photo, if one was made).
      let sent = false;
      if (selfie) {
        try {
          await setDoc(doc(db, "verifications", cred.user.uid), {
            uid: cred.user.uid,
            fullName: form.fullName.trim(),
            purok: form.purok,
            birthday: form.birthday,
            contact,
            email: cred.user.email ?? form.email.trim(),
            selfie,
            status: "pending",
            submittedAt: serverTimestamp(),
          });
          makeFaceThumb(selfie).then((faceThumb) => updateDoc(doc(db, "users", cred.user.uid), { faceThumb })).catch(() => {});
          logActivity("Verification", `Nagpadala ng selfie sa pag-register (${form.purok})`, cred.user.uid);
          sent = true;
        } catch (selfieErr) {
          console.warn("[register] selfie not saved:", selfieErr);
        }
      }
      toast(sent ? "Na-register ka na at naipadala ang selfie! Susuriin ito ng Barangay. Pwede mo ring kumpirmahin ang email mo." : "Na-register ka na! Hindi naipadala ang selfie, kaya kumuha ulit dito.");
      router.replace("/verify");
    } catch (err) {
      setError(friendlyError(err));
      setLoading(false);
    }
  };

  const stepNo = step === "selfie" ? 1 : 2;
  const STEPS = ["Selfie", "Detalye"];

  return (
    <div className="mx-auto max-w-md">
      <AuthHero title="Mag-register" subtitle={step === "selfie" ? "Selfie muna, para mabilis. Libre ito." : "Halos tapos ka na. Detalye mo na lang."} />
      <Card className="relative -mt-10">
        <ol className="mb-4 grid grid-cols-2 gap-1.5" aria-label="Mga hakbang">
          {STEPS.map((label, i) => (
            <li key={label} className={`flex flex-col gap-1 text-[0.66rem] font-extrabold uppercase tracking-wide ${i + 1 <= stepNo ? "text-brand-deep" : "text-gray-500"}`} aria-current={i + 1 === stepNo ? "step" : undefined}>
              <span className={`h-1.5 rounded-full ${i + 1 < stepNo ? "bg-emerald-500" : i + 1 === stepNo ? "bg-gold" : "bg-gray-200"}`} />
              {i + 1} {label}
            </li>
          ))}
        </ol>

        {step === "selfie" && (
          <>
            {selfie ? <SelfieReview selfie={selfie} onRetake={() => setSelfie(null)} onUse={() => setStep("details")} /> : <SelfieCapture onCapture={setSelfie} />}
            {!selfie && <p className="mt-3 text-center text-[0.72rem] leading-4 text-gray-600">Gagamitin lang ng Barangay ang selfie mo sa pag-verify at sa Barangay ID, ayon sa Data Privacy Act (RA 10173). Admin lang ang makakakita nito.</p>}
            {!selfie && (
              <>
                <div className="my-4 flex items-center gap-3 text-sm text-gray-400">
                  <span className="h-px flex-1 bg-gray-200" /> o kaya <span className="h-px flex-1 bg-gray-200" />
                </div>
                <GoogleButton onSuccess={() => router.replace("/account")} onError={setError} />
                <ErrorText>{error}</ErrorText>
              </>
            )}
          </>
        )}

        {step === "details" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {selfie && (
              <div className="flex items-center gap-3 rounded-2xl border border-line p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selfie} alt="Selfie mo" className="h-[4.75rem] w-16 shrink-0 rounded-xl border border-line object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.9rem] font-extrabold text-emerald-700">Handa na ang selfie</p>
                  <p className="text-xs text-gray-600">Susuriin ito ng Barangay</p>
                </div>
                <button type="button" onClick={() => { setSelfie(null); setStep("selfie"); }} className="min-h-10 rounded-xl bg-brand-light px-3 text-[0.8rem] font-bold text-brand-dark">Palitan</button>
              </div>
            )}
            <Input label="Buong Pangalan" required autoComplete="name" placeholder="Juan Dela Cruz" value={form.fullName} onChange={update("fullName")} />
            <Select label="Purok" required options={puroks} placeholder="-- Pumili ng Purok --" value={form.purok} onChange={update("purok")} />
            <Input label="Contact Number" type="tel" inputMode="tel" required placeholder="09171234567" value={form.contact} onChange={update("contact")} />
            <Input label="Birthday" type="date" required value={form.birthday} onChange={update("birthday")} />
            <div className="grid grid-cols-2 gap-2">
              <Select label="Kasarian" options={SEX_OPTIONS} placeholder="-- Pumili --" value={form.sex} onChange={update("sex")} />
              <Select label="Civil status" options={CIVIL_STATUS_OPTIONS} placeholder="-- Pumili --" value={form.civilStatus} onChange={update("civilStatus")} />
            </div>
            <Input label="Email" type="email" required autoComplete="email" value={form.email} onChange={update("email")} />
            <Input label="Password" type="password" required autoComplete="new-password" hint="Hindi bababa sa 8 characters" value={form.password} onChange={update("password")} />
            <ErrorText>{error}</ErrorText>
            <Button type="submit" full loading={loading}>Gumawa ng Account at ipadala</Button>
          </form>
        )}
      </Card>
      <p className="mt-4 text-center">
        May account na?{" "}
        <Link href="/login" className="font-bold text-brand underline">Mag-login dito</Link>
      </p>
      <p className="mt-3 rounded-2xl bg-gold-light p-3 text-center text-sm text-gray-800">
        <b>Hindi marunong mag-register?</b> Pumunta sa Barangay Hall dala ang ID at contact number. Ang staff ang magre-register para sa iyo, at makakasali ka rin.
      </p>
    </div>
  );
}
