import { useRef, useState } from "react";
import { compressImage } from "../lib/image";
import { Button } from "./ui";

/**
 * Camera capture -> compressed JPEG data URL. `capture="user"` opens the front camera on
 * phones so the tindera takes a selfie with the cash drawer as proof.
 */
export function PhotoCapture({
  value,
  onChange,
  label = "Kumuha ng Photo",
  facing = "user",
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
  facing?: "user" | "environment";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      onChange(await compressImage(file));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={facing}
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {value ? (
        <div className="relative overflow-hidden rounded-xl border">
          <img src={value} alt="Proof" className="max-h-72 w-full object-cover" />
          <button
            type="button"
            className="absolute right-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-xs font-semibold text-white"
            onClick={() => onChange(null)}
          >
            Ulitin
          </button>
        </div>
      ) : (
        <Button type="button" variant="ghost" className="w-full" loading={busy} onClick={() => inputRef.current?.click()}>
          📷 {label}
        </Button>
      )}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
