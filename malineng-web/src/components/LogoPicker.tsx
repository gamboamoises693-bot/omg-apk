"use client";

import { useState } from "react";
import { ImageUp } from "lucide-react";
import { compressToSquare, type SquareMode } from "@/lib/upload";
import { friendlyError } from "@/lib/format";
import { useToast } from "@/components/Toast";

const MODES: { key: SquareMode; label: string }[] = [
  { key: "auto", label: "Auto" },
  { key: "fill", label: "Punô" },
  { key: "fit", label: "Buo" },
];

/**
 * Small picker for a business logo or a photo. The picture is fitted to a square so it looks good in the round badge:
 * "Auto" crops photos and keeps wide logos whole; "Punô" always fills the square; "Buo" always shows the whole picture.
 */
export function LogoPicker({ logo, onChange, label = "Logo ng negosyo" }: { logo?: string; onChange: (logo: string) => void; label?: string }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<SquareMode>("auto");

  const make = async (f: File, m: SquareMode) => {
    try {
      // 200 px square, white background, well under the 60 KB rule limit.
      onChange(await compressToSquare(f, 200, m));
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };
  const pick = (f?: File) => {
    if (!f) return;
    setFile(f);
    setMode("auto");
    void make(f, "auto");
  };
  const choose = (m: SquareMode) => {
    setMode(m);
    if (file) void make(file, m);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface ring-2 ring-gold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : <ImageUp className="h-5 w-5 text-gray-400" aria-hidden />}
        </span>
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm font-bold">
            {logo ? "Palitan ang larawan" : label}
            <input type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {logo && <button type="button" onClick={() => { onChange(""); setFile(null); }} className="rounded-xl px-3 py-2 text-sm font-bold text-red-700">Alisin</button>}
        </div>
      </div>
      {logo && file && (
        <div className="flex items-center gap-1.5 text-xs" role="group" aria-label="Paano ilalagay ang larawan">
          <span className="text-gray-500">Pagkakalagay:</span>
          {MODES.map((m) => (
            <button key={m.key} type="button" onClick={() => choose(m.key)} className={`rounded-full px-2.5 py-1 font-bold ${mode === m.key ? "bg-brand text-white" : "bg-gray-100 text-gray-600"}`}>{m.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
