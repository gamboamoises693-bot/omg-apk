"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { ATTIRE_LABEL, BLAZER_COLORS, attireThumb, makeIdPhoto, type Attire, type Look } from "@/lib/idPhoto";

/** What the person chose: the look and the made photo (null for the original selfie). */
export interface LookChoice {
  look: Look;
  idPhoto: string | null;
}

const LOOKS: { id: Look; label: string }[] = [
  { id: "original", label: "Orihinal" },
  { id: "white", label: "Puting background" },
  { id: "office", label: "Pang-opisina" },
];
const ATTIRES = Object.keys(ATTIRE_LABEL) as Attire[];

/** Step 2 of registering: the same selfie in three looks for the Barangay ID. The original is what the Barangay verifies. */
export function IdPhotoLook({ selfie, onUse, onRetake }: { selfie: string; onUse: (c: LookChoice) => void; onRetake: () => void }) {
  const [look, setLook] = useState<Look>("original");
  const [attire, setAttire] = useState<Attire>("blazer-tie");
  const [blazer, setBlazer] = useState<string>(BLAZER_COLORS[0]);
  const [made, setMade] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [compare, setCompare] = useState(false);
  const [thumbs, setThumbs] = useState<Partial<Record<Attire, string>>>({});
  const runId = useRef(0);

  // Small pictures of each outfit (drawn on the phone).
  useEffect(() => {
    let live = true;
    Promise.all(ATTIRES.map(async (a) => [a, await attireThumb(a, blazer)] as const)).then((list) => live && setThumbs(Object.fromEntries(list)));
    return () => {
      live = false;
    };
  }, [blazer]);

  // Make the photo whenever the look changes.
  useEffect(() => {
    if (look === "original") {
      setMade(null);
      setError("");
      return;
    }
    const id = ++runId.current;
    setBusy(true);
    setError("");
    makeIdPhoto(selfie, look, attire, blazer)
      .then((url) => id === runId.current && setMade(url))
      .catch(() => {
        if (id !== runId.current) return;
        setError("Hindi magawa ang puting background sa phone na ito. Orihinal na selfie na lang ang gagamitin.");
        setLook("original");
      })
      .finally(() => id === runId.current && setBusy(false));
  }, [look, attire, blazer, selfie]);

  const shown = look === "original" || compare || !made ? selfie : made;

  return (
    <div className="space-y-3">
      <div className="rounded-[1.125rem] border border-line bg-white p-3 shadow-card">
        <div className="relative mx-auto aspect-[4/5] w-full max-w-[19.5rem] overflow-hidden rounded-2xl border border-line bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown} alt={compare ? "Orihinal na selfie" : "Preview ng larawan"} className="h-full w-full object-cover" />
          <span className="absolute left-2 top-2 rounded-full bg-brand-deep/85 px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-wide text-white">{compare || look === "original" ? "Orihinal" : "Para sa ID"}</span>
          {look !== "original" && (
            <button
              type="button"
              onPointerDown={() => setCompare(true)}
              onPointerUp={() => setCompare(false)}
              onPointerLeave={() => setCompare(false)}
              onPointerCancel={() => setCompare(false)}
              className="absolute bottom-2 right-2 min-h-10 rounded-full bg-white/90 px-3 text-[0.74rem] font-extrabold text-brand-deep shadow"
            >
              Pindutin: orihinal
            </button>
          )}
          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 text-sm font-semibold text-brand-dark" role="status">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> Inaayos ang larawan...
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-1 rounded-full bg-[#E4E9F2] p-1" role="tablist" aria-label="Itsura ng larawan">
        {LOOKS.map((l) => (
          <button key={l.id} type="button" role="tab" aria-selected={look === l.id} onClick={() => setLook(l.id)} className={`min-h-11 flex-1 rounded-full px-1 text-[0.74rem] font-bold leading-4 ${look === l.id ? "bg-white text-brand-deep shadow ring-[1.5px] ring-gold" : "text-gray-600"}`}>
            {l.label}
          </button>
        ))}
      </div>

      {look === "office" && (
        <div className="rounded-[1.125rem] border border-line bg-white p-4 shadow-card">
          <p className="mb-2 text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-gray-600">Isusuot</p>
          <div className="grid grid-cols-4 gap-2">
            {ATTIRES.map((a) => (
              <button key={a} type="button" onClick={() => setAttire(a)} aria-pressed={attire === a} className="flex flex-col items-center gap-1 text-center text-[0.68rem] font-bold leading-3 text-gray-800">
                <span className={`block aspect-square w-full overflow-hidden rounded-xl border-2 bg-white ${attire === a ? "border-gold ring-2 ring-gold/35" : "border-line"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {thumbs[a] && <img src={thumbs[a]} alt="" className="h-full w-full object-cover" />}
                </span>
                {ATTIRE_LABEL[a]}
              </button>
            ))}
          </div>
          {(attire === "blazer-tie" || attire === "blazer") && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
              <span className="font-bold">Kulay ng blazer</span>
              {BLAZER_COLORS.map((c) => (
                <button key={c} type="button" aria-label={`Kulay ${c}`} aria-pressed={blazer === c} onClick={() => setBlazer(c)} className={`h-8 w-8 rounded-full ${blazer === c ? "ring-2 ring-gold ring-offset-2" : ""}`} style={{ background: c }} />
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="rounded-xl bg-yellow-50 px-3 py-2.5 text-[0.78rem] leading-[1.15rem] text-yellow-900">
        <b>Ang orihinal mong selfie ang susuriin ng Barangay</b> para ma-verify ang account. Ang inayos na larawan ay para lang sa Barangay ID, at kailangan itong aprubahan ng Kapitan o Secretary bago gamitin.
      </p>

      <div className="grid grid-cols-[1fr_1.5fr] gap-2">
        <Button variant="outline" onClick={onRetake}>Ulitin</Button>
        <Button disabled={busy} onClick={() => onUse({ look, idPhoto: look === "original" ? null : made })}>Gamitin ito, susunod</Button>
      </div>
    </div>
  );
}
