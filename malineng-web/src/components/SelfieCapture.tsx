"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FlipHorizontal2, ImagePlus } from "lucide-react";
import { compressToDataUrl } from "@/lib/upload";
import { friendlyError } from "@/lib/format";

/**
 * Face-scan style camera for the selfie. It shows only things the phone can really measure:
 * light, sharpness and steadiness. When all three are good for two seconds it counts 2, 1 and takes the photo;
 * the big button takes it at any time. Where the camera cannot be opened the person can pick a photo instead.
 * Returns a JPEG data URL cropped to 4:5.
 */
const OUT_W = 600;
const OUT_H = 750;
const SAMPLE_W = 48;
const SAMPLE_H = 60;

type Light = "ok" | "dark" | "bright";
interface Reading {
  light: Light;
  sharp: boolean;
  steady: boolean;
}

const NEON = "#3de1ff";
const MINT = "#8dffcf";

/** Rows of a dark HUD readout. */
function Readout({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className={`min-w-0 rounded-xl border bg-[#0a1830]/70 px-2.5 py-2 ${good ? "border-[#8dffcf]/45" : "border-[#3de1ff]/25"}`}>
      <p className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[#5aa9c4]">{label}</p>
      <p className={`mt-0.5 font-mono text-[0.72rem] font-bold tracking-wide ${good ? "text-[#8dffcf]" : "text-[#ffd479]"}`}>{value}</p>
    </div>
  );
}

export function SelfieCapture({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState("");
  const [reading, setReading] = useState<Reading>({ light: "ok", sharp: false, steady: false });
  const [count, setCount] = useState<number | null>(null);
  const goodSince = useRef(0);
  const shooting = useRef(false);

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

  const shoot = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || shooting.current) return;
    shooting.current = true;
    // Centre crop to 4:5 (not mirrored: the saved photo is the real one).
    const sw = Math.min(v.videoWidth, v.videoHeight * (OUT_W / OUT_H));
    const sh = sw * (OUT_H / OUT_W);
    const c = document.createElement("canvas");
    c.width = OUT_W;
    c.height = OUT_H;
    c.getContext("2d")!.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, OUT_W, OUT_H);
    onCapture(c.toDataURL("image/jpeg", 0.86));
  }, [onCapture]);

  // Measure light, sharpness and steadiness a few times a second, and count down when all are good.
  useEffect(() => {
    if (!ready) return;
    const cv = document.createElement("canvas");
    cv.width = SAMPLE_W;
    cv.height = SAMPLE_H;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    let prev: Float32Array | null = null;
    let counting = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const tick = () => {
      const v = videoRef.current;
      if (!v || !v.videoWidth || shooting.current) return;
      const sw = Math.min(v.videoWidth, v.videoHeight * (SAMPLE_W / SAMPLE_H));
      const sh = sw * (SAMPLE_H / SAMPLE_W);
      ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, SAMPLE_W, SAMPLE_H);
      const d = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
      const luma = new Float32Array(SAMPLE_W * SAMPLE_H);
      let sum = 0;
      for (let i = 0; i < luma.length; i++) {
        const y = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
        luma[i] = y;
        sum += y;
      }
      const mean = sum / luma.length;
      // Sharpness: average change between neighbouring pixels (a blurry picture changes little).
      let grad = 0;
      for (let y = 0; y < SAMPLE_H - 1; y++) for (let x = 0; x < SAMPLE_W - 1; x++) {
        const i = y * SAMPLE_W + x;
        grad += Math.abs(luma[i] - luma[i + 1]) + Math.abs(luma[i] - luma[i + SAMPLE_W]);
      }
      grad /= luma.length * 2;
      // Steadiness: how much the picture moved since the last look.
      let motion = 0;
      if (prev) {
        for (let i = 0; i < luma.length; i++) motion += Math.abs(luma[i] - prev[i]);
        motion /= luma.length;
      }
      prev = luma;
      const next: Reading = { light: mean < 60 ? "dark" : mean > 220 ? "bright" : "ok", sharp: grad > 2.2, steady: prev !== null && motion < 7 };
      setReading(next);

      const good = next.light === "ok" && next.sharp && next.steady;
      if (!good) {
        goodSince.current = 0;
        if (counting) {
          counting = false;
          timers.splice(0).forEach(clearTimeout);
          setCount(null);
        }
        return;
      }
      if (!goodSince.current) goodSince.current = Date.now();
      if (!counting && Date.now() - goodSince.current > 1500) {
        counting = true;
        setCount(2);
        timers.push(setTimeout(() => setCount(1), 1000));
        timers.push(setTimeout(() => shoot(), 2000));
      }
    };
    const id = setInterval(tick, 250);
    return () => {
      clearInterval(id);
      timers.forEach(clearTimeout);
      goodSince.current = 0;
      setCount(null);
    };
  }, [ready, shoot]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      onCapture(await compressToDataUrl(file, 900, 0.85));
    } catch (err) {
      setProblem(friendlyError(err));
    }
  };

  const lightText = reading.light === "ok" ? "MAGANDA" : reading.light === "dark" ? "MADILIM" : "MASYADONG MALIWANAG";

  return (
    <div className="space-y-3 rounded-[1.6rem] bg-[radial-gradient(120%_70%_at_50%_20%,#0e2a52,#050b18_65%)] p-3 text-[#e6f4ff]">
      <div className="text-center">
        <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[#7fe6ff]">Barangay Malineng</p>
        <p className="mt-0.5 text-[1rem] font-extrabold tracking-[0.06em]">PAG-SCAN NG MUKHA</p>
      </div>

      <div className="relative mx-auto aspect-[4/5] w-full max-w-[19.5rem] overflow-hidden rounded-[1.6rem] bg-[radial-gradient(100%_70%_at_50%_35%,#16345e,#07101f)] shadow-[0_0_0_1px_rgba(61,225,255,0.55),0_0_28px_rgba(61,225,255,0.3)]">
        {!problem && <video ref={videoRef} playsInline muted autoPlay className={`absolute inset-0 h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`} aria-label="Camera" />}
        <svg viewBox="0 0 340 425" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <mask id="selfie-hole"><rect width="340" height="425" fill="#fff" /><ellipse cx="170" cy="200" rx="106" ry="136" fill="#000" /></mask>
            <linearGradient id="selfie-scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={NEON} stopOpacity="0" /><stop offset="1" stopColor={NEON} stopOpacity="0.5" /></linearGradient>
          </defs>
          <rect width="340" height="425" fill="rgba(3,8,18,0.62)" mask="url(#selfie-hole)" />
          <ellipse cx="170" cy="200" rx="124" ry="154" fill="none" stroke="rgba(61,225,255,0.35)" strokeWidth="1" />
          <g stroke={NEON} strokeWidth="2" strokeLinecap="round" opacity="0.85"><path d="M170 40v12M170 348v12M46 200h12M282 200h12M82 90l8 8M258 90l-8 8M82 310l8-8M258 310l-8-8" /></g>
          <ellipse cx="170" cy="200" rx="106" ry="136" fill="none" stroke={count !== null ? MINT : NEON} strokeWidth="2.5" strokeDasharray="3 9" strokeLinecap="round" />
          <g className="selfie-spin" style={{ transformOrigin: "170px 200px" }}><ellipse cx="170" cy="200" rx="106" ry="136" fill="none" stroke={MINT} strokeWidth="3" strokeDasharray="90 760" strokeLinecap="round" transform="rotate(-24 170 200)" /></g>
          <g className="selfie-scanline"><rect x="64" y="118" width="212" height="46" fill="url(#selfie-scan)" opacity="0.7" /><line x1="60" y1="164" x2="280" y2="164" stroke={MINT} strokeWidth="2" /></g>
          <g stroke="#e6f4ff" strokeWidth="3" strokeLinecap="round" fill="none"><path d="M16 48V16h34M290 16h34v32M16 377v32h34M290 409h34v-32" /></g>
        </svg>
        <p className="absolute left-3.5 top-3 font-mono text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[#8dffcf]">● {count !== null ? "SCANNING" : "LIVE"}</p>
        <p className="absolute right-3.5 top-3 font-mono text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[#7fe6ff]">CAM 01</p>
        {count !== null && <p className="absolute right-4 top-6 font-mono text-[3rem] font-bold leading-none text-[#8dffcf] [text-shadow:0_0_18px_rgba(61,225,255,0.9)]" aria-live="assertive">{count}</p>}
        {problem ? (
          <p className="absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-sm font-semibold">{problem}</p>
        ) : (
          <p className="absolute inset-x-0 bottom-3 text-center text-[0.82rem] font-bold [text-shadow:0_0_10px_rgba(61,225,255,0.8)]">{!ready ? "Binubuksan ang camera..." : count !== null ? "Huwag gumalaw..." : "Ilagay ang mukha sa loob ng oval"}</p>
        )}
      </div>

      <div className="mx-auto grid max-w-[19.5rem] grid-cols-3 gap-2" aria-live="polite">
        <Readout label="Liwanag" value={lightText} good={reading.light === "ok"} />
        <Readout label="Linaw" value={reading.sharp ? "MALINAW" : "MALABO"} good={reading.sharp} />
        <Readout label="Steady" value={reading.steady ? "STEADY" : "GUMAGALAW"} good={reading.steady} />
      </div>

      <div className="mx-auto flex max-w-[19.5rem] items-center justify-between">
        <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-12 min-w-[5.2rem] flex-col items-center justify-center gap-0.5 text-[0.7rem] font-bold text-[#7fe6ff]">
          <ImagePlus className="h-5 w-5" aria-hidden /> Mag-upload
        </button>
        <button type="button" onClick={shoot} disabled={!ready} aria-label="Kumuha ng selfie" className="relative flex h-20 w-20 items-center justify-center disabled:opacity-40">
          <svg viewBox="0 0 80 80" className="absolute inset-0" aria-hidden><circle cx="40" cy="40" r="36" fill="none" stroke="rgba(61,225,255,0.25)" strokeWidth="3" /><circle cx="40" cy="40" r="36" fill="none" stroke={NEON} strokeWidth="3" strokeLinecap="round" strokeDasharray="226" strokeDashoffset={count === null ? 226 : count === 2 ? 113 : 40} transform="rotate(-90 40 40)" style={{ transition: "stroke-dashoffset 0.9s linear" }} /></svg>
          <span className="block h-14 w-14 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff,#9be9ff_55%,#2aa9d6)] shadow-[0_0_22px_rgba(61,225,255,0.7)]" />
        </button>
        <button type="button" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} className="flex min-h-12 min-w-[5.2rem] flex-col items-center justify-center gap-0.5 text-[0.7rem] font-bold text-[#7fe6ff]">
          <FlipHorizontal2 className="h-5 w-5" aria-hidden /> Palitan ang camera
        </button>
      </div>
      <p className="px-3 text-center text-[0.68rem] leading-4 text-[#7da3bd]">Kusa itong kukuha kapag steady ang phone at maliwanag. Pwede mo ring pindutin ang malaking button anumang oras.</p>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

/** The shot selfie, to look over before using it. */
export function SelfieReview({ selfie, onRetake, onUse }: { selfie: string; onRetake: () => void; onUse: () => void }) {
  return (
    <div className="space-y-3 rounded-[1.6rem] bg-[radial-gradient(120%_70%_at_50%_20%,#0e2a52,#050b18_65%)] p-3 text-[#e6f4ff]">
      <div className="text-center">
        <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[#7fe6ff]">Barangay Malineng</p>
        <p className="mt-0.5 text-[1rem] font-extrabold tracking-[0.06em]">SURIIN ANG SELFIE</p>
      </div>
      <div className="relative mx-auto aspect-[4/5] w-full max-w-[18.75rem] overflow-hidden rounded-[1.6rem] shadow-[0_0_0_1px_rgba(141,255,207,0.6),0_0_30px_rgba(141,255,207,0.25)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={selfie} alt="Ang selfie mo" className="h-full w-full object-cover" />
        <svg viewBox="0 0 300 375" className="absolute inset-0 h-full w-full" aria-hidden><g stroke={MINT} strokeWidth="3" strokeLinecap="round" fill="none"><path d="M14 44V14h30M256 14h30v30M14 331v30h30M256 361h30v-30" /></g></svg>
        <p className="absolute left-3.5 top-3 font-mono text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[#8dffcf] [text-shadow:0_0_6px_rgba(0,0,0,0.6)]">● CAPTURED</p>
      </div>
      <ul className="mx-auto max-w-[18.75rem] divide-y divide-[#3de1ff]/15 rounded-2xl border border-[#3de1ff]/25 bg-[#0a1830]/70 px-3.5 text-[0.84rem]">
        {["Kita ang buong mukha", "Walang shades, mask o sombrero", "Maliwanag at hindi malabo"].map((t) => <li key={t} className="flex min-h-10 items-center gap-2.5 text-[#c9e8f5]"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#8dffcf] text-[0.7rem] text-[#8dffcf]" aria-hidden>✓</span>{t}</li>)}
      </ul>
      <div className="mx-auto grid max-w-[18.75rem] grid-cols-[1fr_1.5fr] gap-2">
        <button type="button" onClick={onRetake} className="min-h-12 rounded-full border-[1.5px] border-[#3de1ff]/60 text-[0.92rem] font-bold text-[#7fe6ff]">Ulitin</button>
        <button type="button" onClick={onUse} className="min-h-12 rounded-full bg-gradient-to-b from-[#5af0ff] to-[#1ea6d6] text-[0.95rem] font-extrabold text-[#03111f] shadow-[0_0_20px_rgba(61,225,255,0.5)]">Gamitin ito, susunod</button>
      </div>
      <p className="px-3 text-center text-[0.68rem] leading-4 text-[#7da3bd]">Ito ang selfie na susuriin ng Barangay para ma-verify ang account mo, at ito rin ang lalabas sa Barangay ID mo.</p>
    </div>
  );
}
