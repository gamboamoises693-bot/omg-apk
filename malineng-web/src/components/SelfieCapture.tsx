"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, FlipHorizontal2, ImagePlus } from "lucide-react";
import { compressToDataUrl } from "@/lib/upload";
import { friendlyError } from "@/lib/format";

/**
 * Live camera for the selfie: an oval to put the face in, three short tips and a big shutter button.
 * Where the camera cannot be opened (no permission, no camera, plain http) the person can pick a photo instead.
 * Returns a JPEG data URL cropped to 4:5.
 */
const OUT_W = 600;
const OUT_H = 750;

export function SelfieCapture({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState("");

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let live = true;
    setReady(false);
    setProblem("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem("Hindi mabuksan ang camera sa phone na ito. Pumili na lang ng larawan.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((stream) => {
        if (!live) return stream.getTracks().forEach((t) => t.stop());
        stop();
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          void v.play().then(() => live && setReady(true));
        }
      })
      .catch(() => live && setProblem("Hindi nabuksan ang camera. Payagan ang camera sa browser, o pumili na lang ng larawan."));
    return () => {
      live = false;
      stop();
    };
  }, [facing, stop]);

  const shoot = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    // Centre crop to 4:5 (not mirrored: the saved photo is the real one).
    const sw = Math.min(v.videoWidth, v.videoHeight * (OUT_W / OUT_H));
    const sh = sw * (OUT_H / OUT_W);
    const c = document.createElement("canvas");
    c.width = OUT_W;
    c.height = OUT_H;
    c.getContext("2d")!.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, OUT_W, OUT_H);
    onCapture(c.toDataURL("image/jpeg", 0.86));
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      onCapture(await compressToDataUrl(file, 900, 0.85));
    } catch (err) {
      setProblem(friendlyError(err));
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-[4/5] w-full max-w-[19.5rem] overflow-hidden rounded-3xl bg-[radial-gradient(120%_90%_at_50%_30%,#2a3550,#0e1424)] shadow-float">
        {!problem && <video ref={videoRef} playsInline muted autoPlay className={`absolute inset-0 h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`} aria-label="Camera" />}
        {/* Oval guide and corner marks */}
        <svg viewBox="0 0 310 388" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <mask id="selfie-hole"><rect width="310" height="388" fill="#fff" /><ellipse cx="155" cy="180" rx="98" ry="128" fill="#000" /></mask>
          </defs>
          <rect width="310" height="388" fill="rgba(5,10,20,0.6)" mask="url(#selfie-hole)" />
          <ellipse cx="155" cy="180" rx="98" ry="128" fill="none" stroke="#D4AF37" strokeWidth="3" strokeDasharray="10 8" />
          <g stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.85"><path d="M18 44V20h24M268 20h24v24M18 344v24h24M268 368h24v-24" /></g>
        </svg>
        {problem ? (
          <p className="absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-sm font-semibold text-white">{problem}</p>
        ) : (
          <p className="absolute inset-x-0 bottom-3 text-center text-[0.85rem] font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">{ready ? "Ilagay ang mukha sa loob ng oval" : "Binubuksan ang camera..."}</p>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2 text-[0.74rem] font-bold text-gray-700">
        {["Maliwanag", "Walang shades o mask", "Harap sa camera"].map((t) => <span key={t} className="rounded-full bg-brand-light px-3 py-1.5">{t}</span>)}
      </div>

      <div className="mx-auto flex max-w-[19.5rem] items-center justify-between">
        <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-12 min-w-[5.5rem] flex-col items-center justify-center gap-0.5 text-[0.72rem] font-bold text-brand-dark">
          <ImagePlus className="h-5 w-5" aria-hidden /> Mag-upload
        </button>
        <button type="button" onClick={shoot} disabled={!ready} aria-label="Kumuha ng selfie" className="flex h-[4.6rem] w-[4.6rem] items-center justify-center rounded-full border-4 border-brand-dark disabled:opacity-40">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold text-brand-deep"><Camera className="h-6 w-6" aria-hidden /></span>
        </button>
        <button type="button" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} className="flex min-h-12 min-w-[5.5rem] flex-col items-center justify-center gap-0.5 text-[0.72rem] font-bold text-brand-dark">
          <FlipHorizontal2 className="h-5 w-5" aria-hidden /> Palitan ang camera
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
