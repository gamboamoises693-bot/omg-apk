"use client";

import { useState, type FormEvent } from "react";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { HandCoins, SearchX, CheckCircle2, CalendarClock, PackageCheck } from "lucide-react";
import { db } from "@/lib/firebase";
import { AYUDA_STATUS_LABEL } from "@/lib/constants";
import { friendlyError, normalizeName, timeAgo } from "@/lib/format";
import type { Ayuda } from "@/lib/types";
import { Button, Card, ErrorText, Input, PageHeader } from "@/components/ui";

const STATUS_STYLE = {
  qualified: { cls: "bg-brand-light text-brand", icon: CheckCircle2 },
  scheduled: { cls: "bg-gold-light text-yellow-800", icon: CalendarClock },
  claimed: { cls: "bg-gray-100 text-gray-700", icon: PackageCheck },
} as const;

export default function AyudaPage() {
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Ayuda[] | null>(null);
  const [error, setError] = useState("");

  const handleCheck = async (e: FormEvent) => {
    e.preventDefault();
    const value = term.trim();
    if (!value) return setError("Ilagay ang buong pangalan o control number.");
    setError("");
    setLoading(true);
    try {
      // 1) Try control number (document ID).
      const byId = await getDoc(doc(db, "ayuda", value.toUpperCase()));
      if (byId.exists()) {
        setResults([{ id: byId.id, ...byId.data() } as Ayuda]);
        return;
      }
      // 2) Try exact full name (case-insensitive via nameLower). Limit must stay <= 5 (security rule).
      const snap = await getDocs(query(collection(db, "ayuda"), where("nameLower", "==", normalizeName(value)), limit(5)));
      setResults(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Ayuda));
    } catch (err) {
      setError(friendlyError(err));
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Ayuda Checker" subtitle="Alamin kung kasama ka sa ayuda" />
      <Card>
        <form onSubmit={handleCheck} className="space-y-4">
          <Input
            label="Buong Pangalan O Control Number"
            placeholder="Hal. Juan Dela Cruz o AYD-2026-0001"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            hint="Isulat ang pangalan katulad ng nasa listahan (First name Last name)."
          />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" full loading={loading}><HandCoins className="h-5 w-5" /> I-check</Button>
        </form>
      </Card>

      {results && (
        <div className="mt-4 space-y-3">
          {results.length === 0 ? (
            <Card className="text-center">
              <SearchX className="mx-auto mb-2 h-12 w-12 text-gray-400" />
              <p className="font-semibold text-gray-700">Walang record. Paki-check ang spelling o magtanong sa Barangay Hall.</p>
            </Card>
          ) : (
            results.map((r) => {
              const style = STATUS_STYLE[r.status] ?? STATUS_STYLE.qualified;
              const Icon = style.icon;
              return (
                <Card key={r.id}>
                  <p className="text-sm text-gray-500">Control No. {r.controlNumber || r.id}</p>
                  <p className="text-xl font-bold">{r.fullName}</p>
                  <p className="mt-1 text-gray-700">Program: <b>{r.program}</b></p>
                  <div className={`mt-3 flex items-center gap-2 rounded-xl px-4 py-3 text-lg font-bold ${style.cls}`}>
                    <Icon className="h-6 w-6" /> {AYUDA_STATUS_LABEL[r.status] ?? r.status}
                  </div>
                  {r.remarks && <p className="mt-3 whitespace-pre-line text-gray-700"><b>Remarks:</b> {r.remarks}</p>}
                  {r.updatedAt && <p className="mt-2 text-sm text-gray-400">Huling update: {timeAgo(r.updatedAt)}</p>}
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
