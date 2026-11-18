"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { BarangayIdCard } from "@/components/BarangayIdCard";
import { useCaptainSignature } from "@/lib/signature";

/** The sample photo: the Barangay Captain's picture (public/sample-id-photo.jpg). */
const SAMPLE_PHOTO = "/sample-id-photo.jpg";

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
          name="Romando F. Gamboa"
          purok="Purok 6"
          birthday="1960-08-28"
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
