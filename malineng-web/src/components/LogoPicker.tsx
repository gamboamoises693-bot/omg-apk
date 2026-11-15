"use client";

import { ImageUp } from "lucide-react";
import { compressToDataUrl } from "@/lib/upload";
import { friendlyError } from "@/lib/format";
import { useToast } from "@/components/Toast";

/** Small picker for a business logo: shows a preview, "Palitan" and "Alisin". */
export function LogoPicker({ logo, onChange, label = "Logo ng negosyo" }: { logo?: string; onChange: (logo: string) => void; label?: string }) {
  const toast = useToast();
  const pick = async (file?: File) => {
    if (!file) return;
    try {
      // About 160px, white background, well under the 60KB rule limit.
      onChange(await compressToDataUrl(file, 160, 0.85, 45_000));
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface ring-1 ring-gray-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logo ? <img src={logo} alt="" className="h-full w-full object-contain p-0.5" /> : <ImageUp className="h-5 w-5 text-gray-400" aria-hidden />}
      </span>
      <div className="flex flex-wrap gap-2">
        <label className="cursor-pointer rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm font-bold">
          {logo ? "Palitan ang logo" : label}
          <input type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {logo && <button type="button" onClick={() => onChange("")} className="rounded-xl px-3 py-2 text-sm font-bold text-red-700">Alisin</button>}
      </div>
    </div>
  );
}
