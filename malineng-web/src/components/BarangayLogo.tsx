"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { doc, setDoc } from "firebase/firestore";
import { Camera, Home, ImageUp, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/lib/useSettings";
import { compressLogo } from "@/lib/upload";
import { logActivity } from "@/lib/activity";
import { friendlyError } from "@/lib/format";
import { Button, ErrorText, Modal } from "./ui";
import { useToast } from "./Toast";

/** The barangay seal, or the default gold "M" mark when none is uploaded. */
export function LogoMark({ size = "h-8 w-8", textClass = "text-sm" }: { size?: string; textClass?: string }) {
  const { settings } = useSettings();
  if (settings.logoURL) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={settings.logoURL} alt="Logo ng Barangay Malineng" className={`${size} shrink-0 rounded-full bg-white object-contain`} />;
  }
  return <span className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-gold font-black text-brand-deep ${textClass}`}>M</span>;
}

/**
 * Logo button. Residents: goes Home. Admins: opens "Palitan ang logo".
 * Wraps arbitrary children (e.g. the logo + barangay name).
 */
export function LogoButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { isAdmin } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!isAdmin) {
    return <Link href="/" className={className}>{children}</Link>;
  }

  const pick = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      setPreview(await compressLogo(file));
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  const save = async (logoURL: string) => {
    setBusy(true);
    try {
      await setDoc(doc(db, "settings", "main"), { logoURL }, { merge: true });
      logActivity("Settings", logoURL ? "Pinalitan ang logo ng Barangay" : "Tinanggal ang logo ng Barangay");
      toast(logoURL ? "Napalitan ang logo!" : "Ibinalik sa default na logo.");
      setPreview(null);
      setOpen(false);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const shown = preview ?? settings.logoURL;

  return (
    <>
      <button onClick={() => setOpen(true)} className={`relative text-left ${className}`} aria-label="Logo ng Barangay (pindutin para palitan)">
        {children}
      </button>
      <Modal open={open} onClose={() => { setOpen(false); setPreview(null); setError(""); }} title="Logo ng Barangay">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              {shown ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shown} alt="Preview ng logo" className="h-32 w-32 rounded-full bg-gray-50 object-contain ring-1 ring-gray-200" />
              ) : (
                <span className="flex h-32 w-32 items-center justify-center rounded-full bg-gold text-5xl font-black text-brand-deep">M</span>
              )}
              <span className="absolute bottom-1 right-1 rounded-full bg-brand p-2 text-white"><Camera className="h-4 w-4" /></span>
            </div>
          </div>
          <p className="text-center text-xs text-gray-500">Mas maganda kung parisukat (square) at may transparent o puting background. Lalabas ito sa itaas ng website at sa mga Clearance.</p>
          <ErrorText>{error}</ErrorText>
          {preview ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => inputRef.current?.click()}>Pumili ng iba</Button>
              <Button loading={busy} onClick={() => save(preview)}>I-save ang logo</Button>
            </div>
          ) : (
            <Button full onClick={() => inputRef.current?.click()}><ImageUp className="h-4 w-4" /> Pumili ng bagong logo</Button>
          )}
          {settings.logoURL && !preview && (
            <Button variant="ghost" full loading={busy} onClick={() => save("")}><Trash2 className="h-4 w-4" /> Ibalik sa default (M)</Button>
          )}
          <Link href="/" onClick={() => setOpen(false)} className="flex items-center justify-center gap-1 text-sm font-semibold text-brand">
            <Home className="h-4 w-4" /> Pumunta sa Home
          </Link>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      </Modal>
    </>
  );
}
