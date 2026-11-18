"use client";

import { useEffect, useMemo, useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { MAX_POST_PHOTOS } from "@/lib/postPhotos";

/** Photo picker for a post: up to 4 pictures, shown as small tiles that can be removed one by one. */
export function MultiImagePicker({ files, onChange, label = "Mga larawan (optional, hanggang 4)" }: { files: File[]; onChange: (files: File[]) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const add = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list).filter((f) => f.type.startsWith("image/"));
    onChange([...files, ...picked].slice(0, MAX_POST_PHOTOS));
    if (input.current) input.current.value = "";
  };

  return (
    <div>
      <span className="mb-1 flex items-center justify-between font-semibold text-gray-800">
        {label}
        {files.length > 0 && <span className="text-xs font-bold text-gray-500">{files.length}/{MAX_POST_PHOTOS}</span>}
      </span>
      <div className="grid grid-cols-4 gap-2">
        {urls.map((u, i) => (
          <div key={u} className="relative aspect-square overflow-hidden rounded-xl bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`Larawan ${i + 1}`} className="h-full w-full object-cover" />
            <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label={`Tanggalin ang larawan ${i + 1}`}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {files.length < MAX_POST_PHOTOS && (
          <button type="button" onClick={() => input.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed border-gray-300 bg-surface text-gray-600 active:bg-gray-200" aria-label="Magdagdag ng larawan">
            <ImagePlus className="h-6 w-6" aria-hidden />
            <span className="text-[0.65rem] font-bold">{files.length === 0 ? "Larawan" : "Dagdag"}</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />
    </div>
  );
}
