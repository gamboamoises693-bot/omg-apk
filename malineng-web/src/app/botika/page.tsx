"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, type Timestamp } from "firebase/firestore";
import { Pill, Search, ShieldCheck } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { timeAgo } from "@/lib/format";
import type { PublicMedicine } from "@/lib/botika";
import { Badge, EmptyState, FilterTabs, LinkButton, PageHeader, Spinner } from "@/components/ui";

type Filter = "lahat" | "meron" | "ubos";

/** Public list of Botika medicines: available or not (no exact counts). */
export default function BotikaPage() {
  const { canBotika } = useAuth();
  const [items, setItems] = useState<PublicMedicine[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Timestamp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("meron");

  useEffect(
    () =>
      onSnapshot(
        doc(db, "botikaPublic", "main"),
        (snap) => {
          const data = snap.data();
          setItems((data?.items as PublicMedicine[]) ?? []);
          setUpdatedAt((data?.updatedAt as Timestamp) ?? null);
          setLoading(false);
        },
        () => {
          setError("Hindi ma-load ang listahan. I-check ang internet.");
          setLoading(false);
        },
      ),
    [],
  );

  const list = useMemo(() => {
    const t = search.trim().toLowerCase();
    return items.filter((m) => {
      if (filter === "meron" && !m.available) return false;
      if (filter === "ubos" && m.available) return false;
      return !t || `${m.name} ${m.category}`.toLowerCase().includes(t);
    });
  }, [items, filter, search]);

  const availableCount = items.filter((m) => m.available).length;

  return (
    <div>
      <PageHeader title="Botika ng Barangay" subtitle="Libreng gamot para sa residente ng Malineng" />

      {canBotika && (
        <LinkButton href="/botika/manage" variant="gold" full className="mb-3">
          <ShieldCheck className="h-5 w-5" /> Pamahalaan ang Botika (BHW)
        </LinkButton>
      )}

      <p className="mb-3 rounded-2xl bg-brand-light p-3 text-sm text-brand-dark">
        Pumunta sa <b>Barangay Health Station</b> at hanapin ang BHW. Dalhin ang <b>reseta</b> para sa mga gamot na kailangan nito (hal. antibiotic).
      </p>

      <label className="mb-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3">
        <Search className="h-4 w-4 text-gray-400" aria-hidden />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hanapin ang gamot..." aria-label="Hanapin ang gamot" className="w-full bg-transparent py-2.5 outline-none" />
      </label>

      <FilterTabs
        label="Filter ng gamot"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "meron", label: "Meron", count: availableCount, tone: "neutral" },
          { value: "ubos", label: "Ubos", count: items.length - availableCount, tone: "neutral" },
          { value: "lahat", label: "Lahat" },
        ]}
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : list.length === 0 ? (
        <EmptyState icon={<Pill />} title={items.length === 0 ? "Wala pang nakalistang gamot" : "Walang tugma"} />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-card">
          {list.map((m) => (
            <li key={m.name} className="flex items-center gap-3 px-3 py-2.5">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${m.available ? "bg-brand-light text-brand" : "bg-gray-100 text-gray-400"}`}>
                <Pill className="h-[1.1rem] w-[1.1rem]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-bold ${m.available ? "" : "text-gray-500"}`}>{m.name}</p>
                <p className="truncate text-xs text-gray-500">
                  {m.category}
                  {m.needsPrescription ? " · kailangan ng reseta" : ""}
                </p>
              </div>
              {m.available ? <Badge color="green">Meron</Badge> : <Badge color="gray">Ubos</Badge>}
            </li>
          ))}
        </ul>
      )}

      {updatedAt && <p className="mt-3 text-center text-xs text-gray-400">Huling update {timeAgo(updatedAt)}</p>}
    </div>
  );
}
