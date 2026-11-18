"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { BarangayIdCard } from "@/components/BarangayIdCard";
import { useCaptainSignature } from "@/lib/signature";

/** A plain silhouette used as the photo of the sample (not a real person). */
const SAMPLE_PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 168"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCE3EF"/><stop offset="1" stop-color="#A9B8D0"/></linearGradient></defs><rect width="128" height="168" fill="url(#g)"/><circle cx="64" cy="64" r="26" fill="#5B6B8C"/><path d="M14 168c0-40 22-62 50-62s50 22 50 62z" fill="#5B6B8C"/></svg>',
  );

/**
 * What the Barangay ID looks like, for people who are not logged in (shown under the "log in" prompt on the Barangay ID page).
 * View only: stamped HALIMBAWA, hidden when printing, and its QR leads to the home page, not to a real ID.
 */
export function SampleIdCard() {
  const captain = useCaptainSignature();
  const [qr, setQr] = useState("");
  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/`, { margin: 1, width: 300, errorCorrectionLevel: "M" }).then(setQr, () => setQr(""));
  }, []);

  return (
    <div className="mt-4 space-y-3 print:hidden" onContextMenu={(e) => e.preventDefault()}>
      <p className="rounded-2xl bg-white p-3 text-center text-sm text-gray-700 shadow-card">
        <b>Halimbawa ito ng Barangay ID.</b> Lalabas ang sarili mong ID, may litrato, QR at ID number, pagkatapos mong mag-login at ma-verify.
      </p>
      <div className="relative select-none" data-no-i18n>
        <BarangayIdCard
          idNo="MG-0000-0000"
          name="JUAN DELA CRUZ"
          purok="Purok 1"
          birthday="1990-05-12"
          sex="Lalaki"
          civilStatus="Kasal"
          selfie={SAMPLE_PHOTO}
          verified
          qr={qr}
          signature={captain.image}
          captainName={captain.name}
        />
        <div className="id-sample-mark" aria-hidden><span>HALIMBAWA</span></div>
      </div>
    </div>
  );
}
