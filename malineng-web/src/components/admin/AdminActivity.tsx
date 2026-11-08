"use client";

import { useMemo, useState } from "react";
import { Timestamp, collection, orderBy, query, where } from "firebase/firestore";
import { Download } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { ACTIVITY_TYPES, roleLabel } from "@/lib/activity";
import { downloadCsv } from "@/lib/csv";
import { todayISO } from "@/lib/format";
import type { ActivityLog } from "@/lib/types";
import { Badge, Button, EmptyState, FilterTabs, Spinner } from "@/components/ui";

function dayRange(dateISO: string, days: number) {
  const start = new Date(`${dateISO}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  start.setDate(start.getDate() - (days - 1));
  return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
}

function parseRole(raw: string): { role: string; position?: string } {
  const [role, position] = raw.split(":");
  return { role, position };
}

/** Super Admin only: append-only log of everything done on the site. */
export function AdminActivity() {
  const [date, setDate] = useState(todayISO());
  const [days, setDays] = useState(1);
  const [type, setType] = useState<string>("Lahat");
  const [who, setWho] = useState<"lahat" | "admin" | "resident">("lahat");

  const q = useMemo(() => {
    const { start, end } = dayRange(date, days);
    return query(collection(db, "activityLogs"), where("createdAt", ">=", start), where("createdAt", "<", end), orderBy("createdAt", "desc"));
  }, [date, days]);
  const { data, loading, error } = useCollection<ActivityLog>(q);

  const list = data.filter((l) => {
    if (type !== "Lahat" && l.type !== type) return false;
    const isStaff = l.actorRole.startsWith("admin") || l.actorRole.startsWith("superadmin");
    if (who === "admin" && !isStaff) return false;
    if (who === "resident" && isStaff) return false;
    return true;
  });

  const exportCsv = () => {
    downloadCsv(`activity-log-${date}${days > 1 ? `-${days}araw` : ""}.csv`, [
      ["Petsa", "Oras", "Sino", "Role", "Uri", "Ginawa"],
      ...list.map((l) => {
        const d = l.createdAt?.toDate();
        const r = parseRole(l.actorRole);
        return [d?.toLocaleDateString("fil-PH") ?? "", d?.toLocaleTimeString("fil-PH", { hour: "numeric", minute: "2-digit" }) ?? "", l.actorName, roleLabel(r.role, r.position), l.type, l.text];
      }),
    ]);
  };

  return (
    <div>
      <div className="mb-3 grid grid-cols-[1fr_auto] gap-2">
        <input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2" aria-label="Petsa" />
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-xl border border-gray-200 bg-white px-3 py-2" aria-label="Saklaw">
          <option value={1}>1 araw</option>
          <option value={7}>7 araw</option>
          <option value={30}>30 araw</option>
        </select>
      </div>
      <FilterTabs
        label="Sino"
        value={who}
        onChange={setWho}
        options={[
          { value: "lahat", label: "Lahat" },
          { value: "admin", label: "Admins" },
          { value: "resident", label: "Residente" },
        ]}
      />
      <FilterTabs label="Uri ng aktibidad" value={type} onChange={setType} options={["Lahat", ...ACTIVITY_TYPES].map((t) => ({ value: t, label: t }))} />

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : list.length === 0 ? (
        <EmptyState title="Walang aktibidad sa napiling petsa" />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-card">
          {list.map((l) => {
            const r = parseRole(l.actorRole);
            const d = l.createdAt?.toDate();
            return (
              <li key={l.id} className="grid grid-cols-[3.6rem_1fr] gap-2 px-3 py-2.5">
                <time className="text-xs font-semibold tabular-nums text-gray-500">
                  {d?.toLocaleTimeString("fil-PH", { hour: "numeric", minute: "2-digit" })}
                  {days > 1 && <span className="block font-normal">{d?.toLocaleDateString("fil-PH", { month: "short", day: "numeric" })}</span>}
                </time>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-sm font-bold">{l.actorName}</span>
                    <Badge color={r.role === "superadmin" ? "blue" : r.role === "admin" ? "green" : "gray"}>{roleLabel(r.role, r.position)}</Badge>
                    <Badge color="gold">{l.type}</Badge>
                  </div>
                  <p className="text-sm text-gray-700">{l.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Button variant="outline" full className="mt-3" onClick={exportCsv} disabled={!list.length}>
        <Download className="h-4 w-4" /> I-export ({list.length}) bilang CSV
      </Button>
      <p className="mt-2 text-center text-xs text-gray-500">Walang makakapagbura o makakapagbago ng mga record dito, pati ang Super Admin.</p>
    </div>
  );
}
