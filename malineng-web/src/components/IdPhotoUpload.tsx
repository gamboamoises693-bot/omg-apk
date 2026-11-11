"use client";

import { useRef, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { ImageUp } from "lucide-react";
import { db } from "@/lib/firebase";
import { compressToDataUrl } from "@/lib/upload";
import { logActivity } from "@/lib/activity";
import { friendlyError } from "@/lib/format";
import { Button, ErrorText } from "./ui";

/**
 * Super Admin only: replace the photo printed on someone's Barangay ID (for example when the selfie came out dark or blurry).
 * The photo is kept in verifications/{uid}.selfie, so the Super Admin's account is the only one allowed to change it.
 */
export function IdPhotoUpload({ uid, name, onSaved }: { uid: string; name: string; onSaved: (photo: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setDone(false);
    try {
      const photo = await compressToDataUrl(file, 600, 0.82, 380_000);
      await updateDoc(doc(db, "verifications", uid), { selfie: photo });
      logActivity("Verification", `Pinalitan ang litrato sa Barangay ID ni ${name}`, uid);
      onSaved(photo);
      setDone(true);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(code === "not-found" ? "Wala pang selfie o verification ang account na ito, kaya wala pang ID na mapapalitan ng litrato." : friendlyError(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="space-y-1.5">
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <Button variant="outline" full loading={busy} onClick={() => input.current?.click()}>
        <ImageUp className="h-4 w-4" aria-hidden /> Palitan ang litrato sa ID (Developer lang)
      </Button>
      {done && <p className="text-center text-xs font-semibold text-emerald-700">Napalitan ang litrato.</p>}
      <ErrorText>{error}</ErrorText>
      <p className="text-center text-xs text-gray-500">Pumili ng malinaw na litrato ng mukha (patayo ang pinakamaganda).</p>
    </div>
  );
}
