"use client";

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { BadgeCheck, Printer, ShieldX } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/lib/useSettings";
import { formatPeso } from "@/lib/format";
import type { Donation } from "@/lib/raffleDonations";
import { LoginGate } from "@/components/LoginGate";
import { DonorCertificate, type CertificateData, type CertificateTheme } from "@/components/DonorCertificate";
import { Card, PageHeader, Spinner } from "@/components/ui";

const CERT_W = 1123;
const CERT_H = 794;

/** Loads the fonts of the certificate (only on this page). Without internet the serif fallback is used. */
function useCertificateFonts() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Inter:wght@600;700&display=swap";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);
}

/** The printed page is A4 landscape with no margin, and the page marks itself so the print style applies. */
function usePrintSetup(ivoryPaper: boolean) {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = "@media print { @page { size: A4 landscape; margin: 0; } }";
    document.head.appendChild(style);
    document.body.classList.add("cert-printing");
    return () => {
      style.remove();
      document.body.classList.remove("cert-printing", "cert-ivory-paper");
    };
  }, []);
  useEffect(() => {
    document.body.classList.toggle("cert-ivory-paper", ivoryPaper);
  }, [ivoryPaper]);
}

/** Checks a certificate from its QR: public, it reads only what is already on the public sponsor list. */
function Verify({ id }: { id: string }) {
  const [s, setS] = useState<{ name: string; what: string; amount: number } | null | undefined>(undefined);
  useEffect(() => {
    if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return setS(null);
    getDoc(doc(db, "raffleSponsors", id))
      .then((x) => setS(x.exists() ? (x.data() as { name: string; what: string; amount: number }) : null))
      .catch(() => setS(null));
  }, [id]);
  if (s === undefined) return <Spinner label="Sinusuri ang sertipiko..." />;
  if (!s) {
    return (
      <Card className="text-center">
        <ShieldX className="mx-auto h-14 w-14 text-red-600" aria-hidden />
        <p className="mt-2 text-xl font-black text-red-700">HINDI MAKITA</p>
        <p className="mt-1 text-sm text-gray-600">Walang donasyong tugma sa sertipikong ito. Makipag-ugnayan sa Barangay Hall.</p>
      </Card>
    );
  }
  return (
    <Card className="text-center">
      <BadgeCheck className="mx-auto h-14 w-14 text-emerald-600" aria-hidden />
      <p className="mt-2 text-xl font-black text-emerald-700">TOTOO ANG SERTIPIKO</p>
      <p className="mt-2 text-lg font-extrabold">{s.name}</p>
      <p className="text-sm text-gray-600">{s.what}{s.amount ? ` · ${formatPeso(s.amount).replace(".00", "")}` : ""}</p>
      <p className="mt-2 text-xs text-gray-500">Natanggap ng Barangay Malineng para sa Raffle ng Barangay.</p>
    </Card>
  );
}

function Certificate({ id }: { id: string }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [d, setD] = useState<Donation | null | undefined>(undefined);
  const [theme, setTheme] = useState<CertificateTheme>("ivory");
  const [ivoryPaper, setIvoryPaper] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  useCertificateFonts();
  // Only the ivory design can leave its background out (the navy one needs its ink).
  usePrintSetup(ivoryPaper && theme === "ivory");

  useEffect(() => {
    if (!id || !user) return;
    getDoc(doc(db, "raffleDonations", id))
      .then((s) => setD(s.exists() ? ({ id: s.id, ...s.data() } as Donation) : null))
      .catch(() => setD(null));
  }, [id, user]);

  // Fit the sheet to the screen (the printed copy ignores this and prints at full size).
  useLayoutEffect(() => {
    const fit = () => wrap.current && setScale(wrap.current.clientWidth / CERT_W);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [d]);

  if (d === undefined) return <Spinner />;
  if (!d || d.status !== "received") {
    return <p className="rounded-2xl bg-white p-4 text-center text-sm text-gray-600 shadow-card">Walang sertipiko na nahanap. Lalabas ito pagkatapos matanggap ng Barangay ang donasyon.</p>;
  }

  const officials = settings.officials;
  const nameOf = (re: RegExp) => officials.find((o) => re.test(o.position))?.name?.toUpperCase() ?? "";
  const data: CertificateData = {
    donorName: d.anon ? "Mapagbigay na Kaibigan" : d.name,
    what: d.what,
    amount: d.amount,
    dateText: d.receivedAt ? d.receivedAt.toDate().toLocaleDateString("fil-PH", { year: "numeric", month: "long", day: "numeric" }) : "",
    receiptNo: d.receiptNo ?? "",
    punongName: nameOf(/punong/i),
    secretaryName: nameOf(/secretary|kalihim/i),
    verifyUrl: `${window.location.origin}/raffle/sertipiko/?id=${d.id}&v=1`,
  };

  return (
    <div className="space-y-3">
      <div className="no-print space-y-3 rounded-2xl bg-white p-3 shadow-card">
        <div className="space-y-2">
          <p className="text-sm font-bold">Kulay ng sertipiko</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Kulay ng sertipiko">
            {([["ivory", "Ivory (executive)"], ["navy", "Navy blue"]] as const).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={theme === v} onClick={() => setTheme(v)} className={`rounded-xl px-2 py-2.5 text-sm font-bold ${theme === v ? "bg-brand text-white" : "bg-surface text-gray-700"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {theme === "ivory" ? (
          <div className="space-y-2">
            <p className="text-sm font-bold">Papel na gagamitin sa pag-print</p>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Papel">
              {([[false, "Puting papel"], [true, "Ivory na papel"]] as const).map(([v, label]) => (
                <button key={label} type="button" aria-pressed={ivoryPaper === v} onClick={() => setIvoryPaper(v)} className={`rounded-xl px-2 py-2.5 text-sm font-bold ${ivoryPaper === v ? "bg-brand text-white" : "bg-surface text-gray-700"}`}>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600">
              {ivoryPaper
                ? "Hindi ipi-print ang kulay ng background, kaya ang kulay ng mismong papel (ivory) ang lalabas. Tipid sa tinta."
                : "Ipi-print ang ivory na kulay sa puting papel. Sa print dialog, i-on ang \"Background graphics\" kung wala pa ang kulay."}
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-600">Ang navy ay ipi-print sa puting papel at mas maraming tinta ang gagamitin. Mas maganda ito sa screen at bilang PDF.</p>
        )}
      </div>

      <div ref={wrap} className="cert-stage w-full overflow-hidden rounded shadow-float" style={{ height: CERT_H * scale }}>
        <div className="cert-scale" style={{ width: CERT_W, height: CERT_H, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <DonorCertificate c={data} theme={theme} />
        </div>
      </div>

      <div className="no-print grid grid-cols-2 gap-2">
        <Link href={`/raffle/resibo/?id=${d.id}`} className="rounded-xl border border-gray-200 bg-white py-2.5 text-center text-sm font-bold text-brand">Bumalik sa resibo</Link>
        <button onClick={() => window.print()} className="flex items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-sm font-bold text-white"><Printer className="h-4 w-4" aria-hidden /> I-print o i-save (A4)</button>
      </div>
      <p className="no-print text-center text-xs text-gray-500">Piliin ang <b>A4</b> at <b>Landscape</b> (pahalang) sa print dialog, at <b>Margins: None</b>. Pwede ring i-save bilang PDF.</p>
    </div>
  );
}

/** What a donor receives: a sample with Omega Purified Ice, open to everyone (no login). Shown from "Certificate of Appreciation" on the sponsor list. */
function Sample() {
  const { settings } = useSettings();
  const [theme, setTheme] = useState<CertificateTheme>("ivory");
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  useCertificateFonts();

  useLayoutEffect(() => {
    const fit = () => wrap.current && setScale(wrap.current.clientWidth / CERT_W);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const nameOf = (re: RegExp) => settings.officials.find((o) => re.test(o.position))?.name?.toUpperCase() ?? "";
  const data: CertificateData = {
    donorName: "Omega Purified Ice",
    what: "Media Noche Package",
    amount: 1500,
    dateText: new Date().toLocaleDateString("fil-PH", { year: "numeric", month: "long", day: "numeric" }),
    receiptNo: "RAF-SAMPLE-0001",
    punongName: nameOf(/punong/i),
    secretaryName: nameOf(/secretary|kalihim/i),
    verifyUrl: `${typeof window === "undefined" ? "" : window.location.origin}/raffle/`,
  };

  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-gold-light p-3 text-sm text-yellow-900"><b>HALIMBAWA LANG ito</b> ng Certificate of Appreciation na matatanggap ng donor kapag natanggap na ng Barangay ang donasyon. Ang pangalan, donasyon at petsa ay papalitan ng sa iyo.</p>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Kulay ng sertipiko">
        {([["ivory", "Ivory (executive)"], ["navy", "Navy blue"]] as const).map(([v, label]) => (
          <button key={v} type="button" aria-pressed={theme === v} onClick={() => setTheme(v)} className={`rounded-xl px-2 py-2.5 text-sm font-bold ${theme === v ? "bg-brand text-white" : "bg-surface text-gray-700"}`}>{label}</button>
        ))}
      </div>
      <div ref={wrap} className="cert-stage w-full overflow-hidden rounded shadow-float" style={{ height: CERT_H * scale }}>
        <div className="cert-scale" style={{ width: CERT_W, height: CERT_H, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <DonorCertificate c={data} theme={theme} />
        </div>
      </div>
      <Link href="/raffle/" className="block rounded-xl bg-brand py-2.5 text-center text-sm font-bold text-white">Bumalik sa Raffle</Link>
    </div>
  );
}

function Inner() {
  const p = useSearchParams();
  const id = p.get("id") ?? "";
  if (p.get("sample") === "1") return <Sample />;
  if (p.get("v") === "1") return <Verify id={id} />;
  return (
    <LoginGate message="Mag-login para makita ang sertipiko mo.">
      <Certificate id={id} />
    </LoginGate>
  );
}

export default function SertipikoPage() {
  return (
    <div>
      <div className="no-print">
        <PageHeader title="Certificate of Appreciation" subtitle="Pasasalamat sa donor" />
      </div>
      <Suspense fallback={<Spinner />}>
        <Inner />
      </Suspense>
    </div>
  );
}
