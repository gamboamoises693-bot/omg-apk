"use client";

import { useMemo, useState } from "react";
import { Timestamp, collection, orderBy, query, where } from "firebase/firestore";
import { Download, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { usePuroks } from "@/lib/useSettings";
import { downloadCsv } from "@/lib/csv";
import { timeAgo } from "@/lib/format";
import { qtyLabel, type MedicineLog } from "@/lib/botika";
import { Button, Card, EmptyState, FilterTabs, Spinner } from "@/components/ui";

type View = "naibigay" | "purok" | "stock";

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return { start: Timestamp.fromDate(new Date(y, m - 1, 1)), end: Timestamp.fromDate(new Date(y, m, 1)) };
}

function itemsText(l: MedicineLog): string {
  return l.items.map((i) => `${i.name} × ${i.qty}`).join(", ");
}

/** Monthly history: who received what, totals per purok, and stock in/out. */
export function BotikaHistory() {
  const puroks = usePuroks();
  const [month, setMonth] = useState(thisMonth());
  const [view, setView] = useState<View>("naibigay");
  const [search, setSearch] = useState("");

  const q = useMemo(() => {
    const { start, end } = monthRange(month || thisMonth());
    return query(collection(db, "medicineLogs"), where("createdAt", ">=", start), where("createdAt", "<", end), orderBy("createdAt", "desc"));
  }, [month]);
  const { data, loading, error } = useCollection<MedicineLog>(q);

  const given = data.filter((l) => l.type === "dispense");
  const stockMoves = data.filter((l) => l.type !== "dispense");

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return given;
    return given.filter((l) => `${l.residentName} ${l.purok} ${itemsText(l)} ${l.reason}`.toLowerCase().includes(t));
  }, [given, search]);

  /** Visits and distinct residents per purok + top medicines this month. */
  const perPurok = useMemo(() => {
    const map = new Map<string, { visits: number; people: Set<string> }>();
    for (const p of puroks) map.set(p, { visits: 0, people: new Set() });
    for (const l of given) {
      const p = l.purok || "Walang purok";
      const row = map.get(p) ?? { visits: 0, people: new Set<string>() };
      row.visits += 1;
      row.people.add(l.residentKey ?? l.residentName ?? "");
      map.set(p, row);
    }
    const rows = [...map.entries()].map(([purok, r]) => ({ purok, visits: r.visits, people: r.people.size }));
    const top = new Map<string, { qty: number; form: string }>();
    for (const l of given) for (const i of l.items) top.set(i.name, { qty: (top.get(i.name)?.qty ?? 0) + i.qty, form: i.form });
    const topList = [...top.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
    return { rows, max: Math.max(1, ...rows.map((r) => r.visits)), topList };
  }, [given, puroks]);

  const exportCsv = () => {
    const rows: (string | number)[][] = [["Petsa", "Oras", "Uri", "Residente", "Purok", "Gamot", "Dahilan", "Tala", "BHW"]];
    for (const l of [...data].reverse()) {
      const d = l.createdAt?.toDate();
      rows.push([
        d?.toLocaleDateString("fil-PH") ?? "",
        d?.toLocaleTimeString("fil-PH", { hour: "numeric", minute: "2-digit" }) ?? "",
        l.type === "dispense" ? "Naibigay" : l.type === "restock" ? "Dumating" : "Itinapon",
        l.residentName ?? "",
        l.purok ?? "",
        itemsText(l),
        l.reason ?? "",
        l.note ?? "",
        l.byName,
      ]);
    }
    downloadCsv(`botika-${month}.csv`, rows);
  };

  return (
    <div>
      <div className="mb-3 flex items-end gap-2">
        <label className="block flex-1">
          <span className="mb-1 block text-[0.85rem] font-semibold text-gray-700">Buwan</span>
          <input type="month" value={month} max={thisMonth()} onChange={(e) => setMonth(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5" />
        </label>
        <Button variant="outline" onClick={exportCsv} disabled={data.length === 0}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      <FilterTabs
        label="Uri ng history"
        value={view}
        onChange={setView}
        options={[
          { value: "naibigay", label: "Naibigay", count: given.length, tone: "neutral" },
          { value: "purok", label: "Per purok" },
          { value: "stock", label: "Stock in/out", count: stockMoves.length, tone: "neutral" },
        ]}
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : view === "purok" ? (
        <Card className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Ilang beses nabigyan per purok</p>
          <div className="grid grid-cols-[minmax(0,5.5rem)_1fr_auto] items-center gap-x-2 gap-y-2 text-[0.82rem]">
            {perPurok.rows.map((r) => (
              <div key={r.purok} className="contents">
                <span className="truncate">{r.purok}</span>
                <span className="h-2.5 rounded-full bg-gray-100">
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${(r.visits / perPurok.max) * 100}%` }} />
                </span>
                <span className="text-right font-bold tabular-nums">
                  {r.visits}
                  <span className="ml-1 font-normal text-gray-500">({r.people} tao)</span>
                </span>
              </div>
            ))}
          </div>
          {perPurok.topList.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Pinakamaraming naibigay</p>
              <ol className="space-y-0.5 text-sm">
                {perPurok.topList.map(([name, v], i) => (
                  <li key={name} className="flex justify-between gap-2">
                    <span className="truncate">{i + 1}. {name}</span>
                    <span className="shrink-0 font-semibold">{qtyLabel(v.qty, v.form)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Card>
      ) : view === "naibigay" ? (
        <>
          <label className="mb-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3">
            <Search className="h-4 w-4 text-gray-400" aria-hidden />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hanapin ang residente, purok o gamot..." aria-label="Hanapin" className="w-full bg-transparent py-2.5 outline-none" />
          </label>
          {filtered.length === 0 ? (
            <EmptyState title="Walang naibigay na gamot sa buwang ito" />
          ) : (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-card">
              {filtered.map((l) => (
                <li key={l.id} className="px-3 py-2.5">
                  <div className="flex justify-between gap-2">
                    <p className="truncate text-sm font-bold">
                      {l.residentName}
                      {!l.residentId && <span className="ml-1 text-[0.7rem] font-normal text-gray-500">(walang account)</span>}
                    </p>
                    <span className="shrink-0 text-xs text-gray-500">{timeAgo(l.createdAt)}</span>
                  </div>
                  <p className="text-[0.82rem] text-gray-700">{itemsText(l)} · {l.reason}</p>
                  <p className="text-xs text-gray-500">
                    {l.purok} · ibinigay ni {l.byName}
                    {l.note ? ` · ${l.note}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : stockMoves.length === 0 ? (
        <EmptyState title="Walang dumating o itinapon sa buwang ito" />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-card">
          {stockMoves.map((l) => (
            <li key={l.id} className="flex items-center gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{itemsText(l)}</p>
                <p className="text-xs text-gray-500">
                  {l.type === "restock" ? `Dumating · ${l.note}` : `Itinapon · ${l.note}`} · {l.byName} · {timeAgo(l.createdAt)}
                </p>
              </div>
              <span className={`shrink-0 text-xs font-bold ${l.type === "restock" ? "text-brand" : "text-red-700"}`}>{l.type === "restock" ? "IN" : "OUT"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
