"use client";

import { useMemo } from "react";
import { collection, orderBy, query } from "firebase/firestore";
import { Gavel } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { formatDate } from "@/lib/format";
import type { PublicDecision } from "@/lib/decisions";
import { EmptyState, PageHeader, Spinner } from "@/components/ui";

/** Transparency: the important decisions the barangay officials approved (without amounts). */
export default function DesisyonPage() {
  const q = useMemo(() => query(collection(db, "decisionsPublic"), orderBy("decidedAt", "desc")), []);
  const { data, loading, error } = useCollection<PublicDecision>(q);

  return (
    <div>
      <PageHeader title="Mga Desisyon" subtitle="Mahahalagang desisyon na inaprubahan ng Barangay" />
      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : data.length === 0 ? (
        <EmptyState icon={<Gavel className="h-8 w-8" />} title="Wala pang nailalathala">Lalabas dito ang mga desisyon pagkatapos aprubahan ng mga opisyal.</EmptyState>
      ) : (
        <div className="space-y-3">
          {data.map((d) => (
            <article key={d.id} className="rounded-2xl bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-extrabold">{d.title}</h2>
                <span className="shrink-0 rounded-full bg-brand-light px-2.5 py-0.5 text-[0.7rem] font-extrabold text-brand">{d.kind}</span>
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{d.detail}</p>
              <p className="mt-2 text-xs font-semibold text-gray-500">Inaprubahan: {d.decidedAt ? formatDate(d.decidedAt.toDate().toISOString().slice(0, 10)) : ""}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
