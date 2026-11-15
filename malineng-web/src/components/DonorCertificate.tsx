"use client";

import { useEffect, useState } from "react";

export interface CertificateData {
  donorName: string;
  what: string;
  /** Peso value, 0 when it has none. */
  amount: number;
  /** "Nobyembre 15, 2026" */
  dateText: string;
  receiptNo: string;
  punongName: string;
  secretaryName: string;
  /** The page the QR opens (checks that the certificate is real). */
  verifyUrl: string;
}

export type CertificateTheme = "ivory" | "navy";

/** Long names get a smaller type so they stay on the line and never push the signatures down. */
export function nameSize(name: string): number {
  const n = name.length;
  return n <= 18 ? 66 : n <= 24 ? 54 : n <= 32 ? 44 : n <= 44 ? 36 : 30;
}

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

/** The QR of the verification page, drawn on the phone (no server). */
function Qr({ text }: { text: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    import("qrcode")
      .then((QR) => QR.toDataURL(text, { margin: 0, width: 240, errorCorrectionLevel: "M", color: { dark: "#14233F", light: "#0000" } }))
      .then((u) => live && setSrc(u))
      .catch(() => live && setSrc(""));
    return () => {
      live = false;
    };
  }, [text]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="QR para sa beripikasyon ng sertipiko" className="cert-qr" /> : <span className="cert-qr" aria-hidden />;
}

/**
 * Certificate of Appreciation for a donor, A4 landscape (1123 x 794 px = 297 x 210 mm at 96 dpi).
 * Ivory paper (or navy), thin gold rules, the official seal of the Barangay. Styles are in globals.css (.cert-*).
 */
export function DonorCertificate({ c, theme = "ivory" }: { c: CertificateData; theme?: CertificateTheme }) {
  return (
    // data-no-i18n: the certificate always reads in Filipino, even when the page is switched to English.
    <div className={`cert-sheet ${theme === "navy" ? "cert-navy" : ""}`} data-no-i18n translate="no">
      <div className="cert-r1" />
      <div className="cert-r2" />
      {["left-[7px] top-[7px]", "right-[7px] top-[7px]", "left-[7px] bottom-[7px]", "right-[7px] bottom-[7px]"].map((p) => (
        <span key={p} className={`cert-nt ${p}`} />
      ))}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="cert-wm" src="/seal-barangay.webp" alt="" />
      <div className="cert-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cert-seal" src="/seal-barangay.webp" alt="Sagisag ng Barangay Malineng" />
        <div className="cert-org">REPUBLIKA NG PILIPINAS &nbsp;·&nbsp; PROBINSYA NG NUEVA ECIJA &nbsp;·&nbsp; BAYAN NG CUYAPO</div>
        <div className="cert-brgy">BARANGAY MALINENG</div>
        <div className="cert-ofc">TANGGAPAN NG PUNONG BARANGAY</div>
        <div className="cert-title"><i /><h2>CERTIFICATE</h2><i /></div>
        <div className="cert-sub">OF APPRECIATION</div>
        <div className="cert-pres">Buong pasasalamat na iginagawad kay</div>
        <div className="cert-name" style={{ fontSize: nameSize(c.donorName), whiteSpace: c.donorName.length > 44 ? "normal" : "nowrap" }}>{c.donorName}</div>
        <div className="cert-body">
          bilang pagkilala sa inyong mapagbigay na donasyon para sa <b>Raffle ng Barangay</b>. Ang inyong kabutihan ay nagdala ng saya at pag-asa sa ating mga kabarangay.
        </div>
        <div className="cert-facts">
          <div><small>IBINIGAY</small><b>{c.what}</b></div>
          <div><small>HALAGA</small><b>{c.amount > 0 ? peso(c.amount) : "—"}</b></div>
          <div><small>PETSA</small><b>{c.dateText}</b></div>
          <div><small>RESIBO BLG.</small><b>{c.receiptNo}</b></div>
        </div>
        <div className="cert-sigs">
          <div><b>{c.punongName || " "}</b><small>PUNONG BARANGAY</small></div>
          <div className="cert-qrbox"><Qr text={c.verifyUrl} /></div>
          <div><b>{c.secretaryName || " "}</b><small>BARANGAY SECRETARY</small></div>
        </div>
      </div>
      <div className="cert-ver"><span>Beripikahin: i-scan ang QR gamit ang camera ng phone</span><span>Salamat po, mula sa Barangay Malineng</span></div>
    </div>
  );
}
