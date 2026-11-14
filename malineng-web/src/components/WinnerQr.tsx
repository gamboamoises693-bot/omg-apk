"use client";

import { useEffect, useState } from "react";
import { verifyUrl } from "@/lib/raffle";

/** The QR of a winner: an admin scans it (with any phone camera) to check the win and hand over the prize. */
export function WinnerQr({ round, code, size = 200 }: { round: number; code: string; size?: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    import("qrcode")
      .then((QR) => QR.toDataURL(verifyUrl(round, code), { margin: 1, width: size * 2, errorCorrectionLevel: "M" }))
      .then((url) => live && setSrc(url))
      .catch(() => live && setSrc(""));
    return () => {
      live = false;
    };
  }, [round, code, size]);
  if (!src) return <div style={{ width: size, height: size }} className="animate-pulse rounded-xl bg-gray-100" aria-label="Ginagawa ang QR" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`QR ng panalo, entry ${code}`} width={size} height={size} className="rounded-xl bg-white" />;
}
