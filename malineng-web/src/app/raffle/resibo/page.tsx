"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { Printer } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { formatPeso } from "@/lib/format";
import type { Donation } from "@/lib/raffleDonations";
import { LoginGate } from "@/components/LoginGate";
import { PageHeader, Spinner } from "@/components/ui";

function Receipt() {
  const id = useSearchParams().get("id") ?? "";
  const { user } = useAuth();
  const [d, setD] = useState<Donation | null | undefined>(undefined);

  useEffect(() => {
    if (!id || !user) return;
    getDoc(doc(db, "raffleDonations", id))
      .then((s) => setD(s.exists() ? ({ id: s.id, ...s.data() } as Donation) : null))
      .catch(() => setD(null));
  }, [id, user]);

  if (d === undefined) return <Spinner />;
  if (!d || d.status !== "received") return <p className="rounded-2xl bg-white p-4 text-center text-sm text-gray-600 shadow-card">Walang resibo na nahanap. Lalabas ito pagkatapos matanggap ng Barangay ang donasyon.</p>;

  const when = d.receivedAt ? d.receivedAt.toDate().toLocaleString("fil-PH", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  return (
    <div className="space-y-3">
      <article className="rounded-2xl border-2 border-dashed border-brand/40 bg-white p-5 shadow-card print:shadow-none">
        <div className="text-center">
          <p className="text-lg font-extrabold tracking-wide text-brand-deep">BARANGAY MALINENG</p>
          <p className="text-xs text-gray-500">Cuyapo, Nueva Ecija</p>
          <h2 className="mt-2 text-xl font-black tracking-wide">RESIBO NG DONASYON</h2>
          <p className="text-xs font-bold text-gray-500">Raffle ng Barangay</p>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          {[
            ["Resibo Blg.", d.receiptNo ?? ""],
            ["Petsa", when],
            ["Mula kay", d.name],
            ["Uri", d.kind],
            ["Ibinigay", d.what],
            ["Halaga", d.amount ? formatPeso(d.amount) : "—"],
            ["Tinanggap ni", d.receivedByName ?? ""],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-gray-100 pb-1.5">
              <dt className="text-gray-500">{k}</dt>
              <dd className="text-right font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 grid grid-cols-2 gap-6 text-center text-xs text-gray-500">
          <div><div className="border-t border-gray-400 pt-1">Pirma ng tumanggap</div></div>
          <div><div className="border-t border-gray-400 pt-1">Pirma ng nagbigay</div></div>
        </div>
        <p className="mt-4 text-center text-[0.7rem] text-gray-500">Salamat sa iyong donasyon! Ito ay patunay ng pagtanggap ng Barangay Malineng. Hindi ito opisyal na resibo ng BIR.</p>
      </article>
      <div className="no-print grid grid-cols-2 gap-2">
        <Link href="/raffle" className="rounded-xl border border-gray-200 bg-white py-2.5 text-center text-sm font-bold text-brand">Bumalik</Link>
        <button onClick={() => window.print()} className="flex items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-sm font-bold text-white"><Printer className="h-4 w-4" aria-hidden /> I-print o i-save</button>
      </div>
    </div>
  );
}

export default function ResiboPage() {
  return (
    <div>
      <PageHeader title="Resibo" subtitle="Patunay ng donasyon" />
      <LoginGate message="Mag-login para makita ang resibo mo.">
        <Suspense fallback={<Spinner />}>
          <Receipt />
        </Suspense>
      </LoginGate>
    </div>
  );
}
