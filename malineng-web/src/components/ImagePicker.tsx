"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

interface ImagePickerProps {
  file: File | null;
  onChange: (file: File | null) => void;
  label?: string;
}

/** Big, thumb-friendly photo picker with preview. Opens camera or gallery on phones. */
export function ImagePicker({ file, onChange, label = "Larawan (optional)" }: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div>
      <span className="mb-1 block font-semibold text-gray-800">{label}</span>
      {preview ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Preview" className="h-52 w-full rounded-xl object-cover" />
          <button
            type="button"
            onClick={() => {
              onChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white"
            aria-label="Tanggalin ang larawan"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-32 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 bg-surface text-gray-600 active:bg-gray-200"
        >
          <Camera className="h-8 w-8" aria-hidden />
          <span className="font-semibold">Pindutin para pumili o kumuha ng larawan</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
