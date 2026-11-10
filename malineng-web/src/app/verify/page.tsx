"use client";

import { verifiedSetAdd, verifiedSetRef } from "@/lib/verified";
import { useEffect, useRef, useState } from "react";
import { doc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { BadgeCheck, Camera, Clock, RotateCcw, XCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { compressToDataUrl } from "@/lib/upload";
import { logActivity } from "@/lib/activity";
import { friendlyError, timeAgo } from "@/lib/format";
import { Button, Card, ErrorText, LinkButton, PageHeader, Spinner } from "@/components/ui";
import { LoginGate } from "@/components/LoginGate";
import { useToast } from "@/components/Toast";

function SelfieStep() {
  const { user, profile, verification, isStaff, isSuperAdmin } = useAuth();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retake, setRetake] = useState(false);

  useEffect(() => setError(""), [selfie]);

  if (!profile) return <Spinner />;
  const status = verification?.status;

  if (status === "verified") {
    return (
      <Card className="text-center">
        <BadgeCheck className="mx-auto mb-1 h-12 w-12 text-blue-600" />
        <p className="text-lg font-bold">Verified na ang account mo!</p>
        <p className="text-sm text-gray-600">May asul na ✓ na sa pangalan mo. Magagamit mo na ang lahat ng features.</p>
        <LinkButton href="/" full className="mt-4">Bumalik sa Home</LinkButton>
      </Card>
    );
  }

  if (status === "pending" && !retake) {
    return (
      <Card className="space-y-3 text-center">
        <Clock className="mx-auto h-12 w-12 text-yellow-600" />
        <p className="text-lg font-bold">Sinusuri pa ng Barangay</p>
        <p className="text-sm text-gray-600">Ipinadala {timeAgo(verification?.submittedAt)}. Karaniwang 1 araw ang pagsusuri. Habang naghihintay, magagamit mo ang Emergency, Board at Ayuda Checker.</p>
        {verification?.selfie && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={verification.selfie} alt="Ang selfie mo" className="mx-auto h-40 w-32 rounded-2xl object-cover" />
        )}
        <Button variant="outline" full onClick={() => setRetake(true)}><RotateCcw className="h-4 w-4" /> Palitan ang selfie</Button>
      </Card>
    );
  }

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      setSelfie(await compressToDataUrl(file, 600, 0.72));
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  const submit = async () => {
    if (!user || !selfie) return;
    if (!consent) return setError("Kailangan ang pagpayag mo bago ipadala.");
    setBusy(true);
    setError("");
    try {
      await setDoc(doc(db, "verifications", user.uid), {
        uid: user.uid,
        fullName: profile.fullName,
        purok: profile.purok,
        birthday: profile.birthday,
        contact: profile.contact,
        email: user.email ?? profile.email ?? "",
        selfie,
        status: "pending",
        submittedAt: serverTimestamp(),
      });
      logActivity("Verification", `Nagpadala ng selfie para sa verification (${profile.purok || "walang purok"})`, user.uid);
      if (isSuperAdmin) {
        // The Super Admin verifies their own account right away (the rules allow only the Super Admin to do this).
        const batch = writeBatch(db);
        batch.update(doc(db, "verifications", user.uid), { status: "verified", reason: "", reviewedBy: user.uid, reviewedByName: profile.fullName, reviewedAt: serverTimestamp() });
        batch.set(doc(db, "verifiedUsers", user.uid), { name: profile.fullName, verifiedAt: serverTimestamp(), verifiedBy: profile.fullName });
        batch.set(verifiedSetRef(), verifiedSetAdd(user.uid), { merge: true });
        await batch.commit();
        logActivity("Verification", "Na-verify ang sariling account (Super Admin)", user.uid);
        toast("Na-verify na ang account mo! Gumagana na ang QR ng Barangay ID.");
      } else {
        toast(isStaff ? "Naipadala ang selfie! Ang Super Admin ang magve-verify nito." : "Naipadala ang selfie! Susuriin ito ng Barangay.");
      }
      setRetake(false);
      setSelfie(null);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3">
      {status === "rejected" && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span><b>Kailangang ulitin ang selfie.</b> {verification?.reason}</span>
        </p>
      )}
      <div>
        <p className="font-bold">Kumuha ng selfie</p>
        <p className="text-sm text-gray-600">
          {isStaff
            ? "Para sa litrato at QR ng Barangay ID mo. Bubukas ang front camera."
            : "Para makumpirma ng Barangay na ikaw talaga ang may-ari ng account. Bubukas ang front camera."}
        </p>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative mx-auto flex aspect-[3/4] w-full max-w-[16rem] items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-b from-gray-700 to-gray-900"
        aria-label={selfie ? "Kumuha ulit ng selfie" : "Buksan ang camera"}
      >
        {selfie ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selfie} alt="Preview ng selfie" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Camera className="h-10 w-10 text-white/80" />
        )}
        <span className="pointer-events-none absolute inset-[12%_18%] rounded-[50%] border-[3px] border-dashed border-white/85" aria-hidden />
        <span className="absolute inset-x-3 bottom-3 rounded-xl bg-black/45 px-2 py-1.5 text-xs font-semibold text-white">
          {selfie ? "Pindutin para kumuha ulit" : "Mukha sa loob ng oval · walang shades o mask · maliwanag"}
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 accent-brand" />
        <span>Pumapayag akong gamitin ng Barangay Malineng ang selfie ko para lang sa pag-verify ng account, ayon sa <b>Data Privacy Act (RA 10173)</b>. Admin lang ang makakakita nito, at mabubura ito kapag binura ko ang account ko.</span>
      </label>

      <ErrorText>{error}</ErrorText>
      {selfie ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => inputRef.current?.click()}><RotateCcw className="h-4 w-4" /> Ulitin</Button>
          <Button onClick={submit} loading={busy} disabled={!consent}>Ipadala</Button>
        </div>
      ) : (
        <Button full onClick={() => inputRef.current?.click()}><Camera className="h-4 w-4" /> Buksan ang camera</Button>
      )}
      <LinkButton href="/" variant="ghost" full>Mamaya na lang</LinkButton>
    </Card>
  );
}

export default function VerifyPage() {
  return (
    <div>
      <PageHeader title="I-verify ang account" subtitle="Selfie para sa seguridad ng mga residente" />
      <LoginGate message="Mag-login muna para ma-verify ang account mo.">
        <SelfieStep />
      </LoginGate>
    </div>
  );
}
