"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { BadgeCheck, ShieldX } from "lucide-react";
import { db } from "@/lib/firebase";
import { formatDate } from "@/lib/format";
import type { IssuedDocument } from "@/lib/types";
import { Card, PageHeader, Spinner } from "@/components/ui";

/** Public page opened by scanning the QR on a printed clearance. Shows only minimal details. */
function Check() {
  const id = useSearchParams().get("id");
  const [d, setD] = useState<IssuedDocument | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    if (!id) return setState("missing");
    getDoc(doc(db, "issuedDocuments", id))
      .then((snap) => {
        if (!snap.exists()) return setState("missing");
        setD({ id: snap.id, ...snap.data() } as IssuedDocument);
        setState("ok");
      })
      .catch(() => setState("missing"));
  }, [id]);

  if (state === "loading") return <Spinner label="Sinusuri ang dokumento..." />;

  const issued = d?.issuedAt?.toDate();
  const expired = issued ? Date.now() - issued.getTime() > 183 * 24 * 60 * 60 * 1000 : false;
  const valid = state === "ok" && d?.valid && !expired;

  return (
    <Card className={`text-center ${valid ? "ring-2 ring-brand" : "ring-2 ring-red-500"}`}>
      {valid ? <BadgeCheck className="mx-auto h-14 w-14 text-brand" /> : <ShieldX className="mx-auto h-14 w-14 text-red-600" />}
      <p className={`mt-1 text-xl font-extrabold ${valid ? "text-brand" : "text-red-600"}`}>
        {state === "missing" ? "HINDI TOTOO / WALANG RECORD" : !d?.valid ? "BINAWI NA (REVOKED)" : expired ? "EXPIRED NA" : "VALID ✓"}
      </p>
      {d && (
        <dl className="mx-auto mt-4 grid max-w-xs grid-cols-[110px_1fr] gap-1 text-left text-sm">
          <dt className="text-gray-500">Dokumento</dt><dd className="font-semibold">{d.type}</dd>
          <dt className="text-gray-500">Pangalan</dt><dd className="font-semibold">{d.fullName}</dd>
          <dt className="text-gray-500">Purok</dt><dd className="font-semibold">{d.purok}</dd>
          <dt className="text-gray-500">Petsa</dt><dd className="font-semibold">{issued ? formatDate(issued) : "—"}</dd>
          <dt className="text-gray-500">Control No.</dt><dd className="font-mono text-xs font-semibold">{d.id.slice(0, 10).toUpperCase()}</dd>
        </dl>
      )}
      <p className="mt-4 text-xs text-gray-500">Opisyal na record ng Barangay Malineng, Cuyapo, Nueva Ecija. Ikumpara ang pangalan sa dokumentong hawak mo.</p>
    </Card>
  );
}

export default function VerifyDocPage() {
  return (
    <div>
      <PageHeader title="I-verify ang dokumento" subtitle="Barangay Clearance / Indigency" />
      <Suspense fallback={<Spinner />}>
        <Check />
      </Suspense>
    </div>
  );
}
