import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import { useSettings } from "./useSettings";

/**
 * The Punong Barangay's signature, printed on every Barangay ID (settings/signature = { image }).
 * Only the Developer uploads it; everyone can read it (the ID page needs it).
 */

/** Turns a photo or scan of a signature (dark ink on light paper) into a small PNG with a transparent background. */
export async function signatureFromFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Larawan lang ang pwedeng i-upload.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Masyadong malaki ang larawan (max 10MB).");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Hindi mabasa ang larawan."));
      i.src = url;
    });
    for (const width of [480, 360, 260]) {
      const scale = Math.min(1, width / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Hindi suportado ng browser ang pag-proseso ng larawan.");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = data.data;
      // Light paper becomes transparent and the ink becomes dark navy, with soft edges.
      for (let i = 0; i < px.length; i += 4) {
        const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        const alpha = Math.max(0, Math.min(1, (225 - lum) / 110));
        px[i] = 11; px[i + 1] = 43; px[i + 2] = 87;
        px[i + 3] = Math.round(alpha * 255);
      }
      ctx.putImageData(data, 0, 0);
      const png = canvas.toDataURL("image/png");
      if (png.length <= 90_000) return png;
    }
    throw new Error("Masyadong komplikado ang larawan. Gumamit ng malinaw na pirma sa puting papel.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The saved signature image ("" when there is none) and the Punong Barangay's name from Settings. */
export function useCaptainSignature(): { image: string; name: string } {
  const { settings } = useSettings();
  const [image, setImage] = useState("");
  useEffect(
    () =>
      onSnapshot(
        doc(db, "settings", "signature"),
        (s) => setImage(s.exists() ? String(s.data().image ?? "") : ""),
        () => setImage(""),
      ),
    [],
  );
  const punong = settings.officials.find((o) => /punong/i.test(o.position));
  return { image, name: punong?.name ?? "" };
}
