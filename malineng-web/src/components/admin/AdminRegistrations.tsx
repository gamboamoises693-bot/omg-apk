"use client";

import { useMemo, useState } from "react";
import { collection } from "firebase/firestore";
import { Copy, Phone } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { REGISTRATION_PURPOSES } from "@/lib/constants";
import { sortNewest, telHref, timeAgo } from "@/lib/format";
import type { Registration } from "@/lib/types";
import { Button, Card, EmptyState, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";

const registrationsCollection = collection(db, "registrations");

export function AdminRegistrations() {
  const toast = useToast();
  const [purpose, setPurpose] = useState<string>("Lahat");
  const { data, loading } = useCollection<Registration>(registrationsCollection);
  const items = useMemo(() => sortNewest(data).filter((r) => purpose === "Lahat" || r.purpose === purpose), [data, purpose]);

  /** Copy as CSV so the admin can paste into Google Sheets. */
  const copyCsv = async () => {
    const csv = ["Pangalan,Purok,Contact,Purpose", ...items.map((r) => [r.fullName, r.purok, r.contact, r.purpose].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    try {
      await navigator.clipboard.writeText(csv);
      toast("Nakopya! I-paste sa Google Sheets.");
    } catch {
      toast("Hindi makopya sa browser na ito.", "error");
    }
  };

  return (
    <div>
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {["Lahat", ...REGISTRATION_PURPOSES].map((p) => (
          <button key={p} onClick={() => setPurpose(p)} className={`shrink-0 rounded-full px-4 py-2 font-semibold ${purpose === p ? "bg-brand text-white" : "bg-white ring-1 ring-gray-200"}`}>{p}</button>
        ))}
      </div>
      <Button variant="outline" full className="mb-3" onClick={copyCsv} disabled={!items.length}><Copy className="h-5 w-5" /> Kopyahin bilang CSV ({items.length})</Button>
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title="Wala pang nagparehistro" />
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <Card key={r.id} className="flex items-center gap-2">
              <div className="flex-1">
                <p className="font-bold">{r.fullName}</p>
                <p className="text-sm text-gray-500">{r.purpose} · {r.purok} · {timeAgo(r.createdAt)}</p>
              </div>
              <a href={telHref(r.contact)} className="rounded-full bg-brand p-2 text-white" aria-label="Tawagan"><Phone className="h-5 w-5" /></a>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
