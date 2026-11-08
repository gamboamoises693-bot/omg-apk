"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import { db } from "@/lib/firebase";
import type { IssuedDocument } from "@/lib/types";
import { Button, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { AdminGate } from "@/components/LoginGate";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Printable Barangay Clearance / Certificate of Indigency with a verification QR code. */
function DocumentView() {
  const id = useSearchParams().get("id");
  const [d, setD] = useState<IssuedDocument | null>(null);
  const [qr, setQr] = useState("");
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    if (!id) return setState("missing");
    getDoc(doc(db, "issuedDocuments", id))
      .then(async (snap) => {
        if (!snap.exists()) return setState("missing");
        setD({ id: snap.id, ...snap.data() } as IssuedDocument);
        const url = `${window.location.origin}/verify-doc/?id=${snap.id}`;
        setQr(await QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" }));
        setState("ok");
      })
      .catch(() => setState("missing"));
  }, [id]);

  if (state === "loading") return <Spinner />;
  if (state === "missing" || !d) return <EmptyState title="Hindi mahanap ang dokumento" />;

  const issued = d.issuedAt?.toDate() ?? new Date();
  const dateLine = `${ordinal(issued.getDate())} day of ${issued.toLocaleDateString("en-US", { month: "long" })}, ${issued.getFullYear()}`;
  const isClearance = d.type === "Barangay Clearance";

  return (
    <div>
      <div className="no-print mb-3 space-y-2">
        <PageHeader title={d.type} subtitle={`Control No. ${d.id.slice(0, 10).toUpperCase()}`} />
        {!d.valid && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">BINAWI ang dokumentong ito. Hindi na ito valid.</p>}
        <Button full onClick={() => window.print()}><Printer className="h-4 w-4" /> I-print / I-save bilang PDF</Button>
      </div>

      <article className="print-sheet mx-auto max-w-[210mm] bg-white p-8 font-serif text-[13px] leading-relaxed text-black shadow-card print:shadow-none">
        <header className="text-center">
          <p>Republic of the Philippines</p>
          <p>Province of Nueva Ecija</p>
          <p>Municipality of Cuyapo</p>
          <p className="mt-1 text-[15px] font-bold tracking-wide">BARANGAY MALINENG</p>
          <p className="text-[12px] font-semibold">OFFICE OF THE PUNONG BARANGAY</p>
          <hr className="my-4 border-black" />
          <h1 className="text-[20px] font-bold tracking-[0.15em]">{isClearance ? "BARANGAY CLEARANCE" : "CERTIFICATE OF INDIGENCY"}</h1>
        </header>

        <section className="mt-6 space-y-4 text-justify">
          <p className="font-bold">TO WHOM IT MAY CONCERN:</p>
          {isClearance ? (
            <p className="indent-10">
              This is to certify that <b className="uppercase">{d.fullName}</b>, Filipino, and a bonafide resident of {d.purok}, Barangay
              Malineng, Cuyapo, Nueva Ecija, is known to me to be of good moral character and has no derogatory record on file in this
              Barangay as of this date.
            </p>
          ) : (
            <p className="indent-10">
              This is to certify that <b className="uppercase">{d.fullName}</b>, a bonafide resident of {d.purok}, Barangay Malineng,
              Cuyapo, Nueva Ecija, belongs to an indigent family in this Barangay.
            </p>
          )}
          <p className="indent-10">
            This certification is issued upon the request of the above-named person for <b>{d.purpose || "whatever legal purpose it may serve"}</b>.
          </p>
          <p className="indent-10">Issued this {dateLine} at Barangay Malineng, Cuyapo, Nueva Ecija.</p>
        </section>

        <footer className="mt-14 flex items-end justify-between gap-6">
          <div className="text-center text-[10px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr && <img src={qr} alt="QR code para i-verify" className="mx-auto h-24 w-24" />}
            <p className="font-semibold">I-scan para i-verify</p>
            <p>Control No. {d.id.slice(0, 10).toUpperCase()}</p>
          </div>
          <div className="min-w-[14rem] text-center">
            <p className="border-t border-black pt-1 font-bold uppercase">{d.signatory || "_______________________"}</p>
            <p>Punong Barangay</p>
          </div>
        </footer>
        <p className="mt-8 text-[10px] italic">Not valid without the official dry seal. Valid for six (6) months from the date of issue.</p>
      </article>
    </div>
  );
}

export default function DokumentoPage() {
  return (
    <AdminGate>
      <Suspense fallback={<Spinner />}>
        <DocumentView />
      </Suspense>
    </AdminGate>
  );
}
