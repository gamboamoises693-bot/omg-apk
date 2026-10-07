import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdmin } from "./AdminContext";
import { todayStats } from "../../services/stores";
import { fmtDate, money } from "../../lib/format";
import { toDate } from "../../lib/dates";
import { nextDueDate } from "../../lib/subscription";
import { Card, Empty, PageTitle } from "../../components/ui";
import { SubStatusBadge } from "../../components/StatusBadge";
import type { SubStatus } from "../../lib/types";

const FILTERS: ("all" | SubStatus)[] = ["all", "active", "trial", "overdue", "expired", "deactivated"];

export default function AdminStores() {
  const { stores } = useAdmin();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return stores.filter(
      (s) =>
        (filter === "all" || s.status === filter) &&
        (!needle ||
          [s.store_name, s.owner_name, s.owner_phone, s.address, s.store_code].some((v) => v.toLowerCase().includes(needle))),
    );
  }, [stores, filter, q]);

  return (
    <div className="space-y-3">
      <PageTitle>All Stores ({stores.length})</PageTitle>
      <input className="input" placeholder="🔎 Search store, owner, phone, location, code" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold capitalize ${
              filter === f ? "bg-brand text-white" : "bg-white text-brand"
            }`}
          >
            {f} ({f === "all" ? stores.length : stores.filter((s) => s.status === f).length})
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty>Walang store na tugma.</Empty>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-brand-light text-left text-xs text-brand">
              <tr>
                <th className="p-2">Store</th>
                <th className="p-2">Owner</th>
                <th className="p-2">Phone</th>
                <th className="p-2">Location</th>
                <th className="p-2">Status</th>
                <th className="p-2 text-right">GCash Fund</th>
                <th className="p-2 text-right">Profit Today</th>
                <th className="p-2">Sub. End</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="p-2">
                    <b>{s.store_name}</b>
                    <div className="text-xs text-slate-500">{s.store_code}</div>
                  </td>
                  <td className="p-2">{s.owner_name}</td>
                  <td className="p-2">{s.owner_phone}</td>
                  <td className="p-2">{s.address}</td>
                  <td className="p-2">
                    <SubStatusBadge status={s.status} />
                  </td>
                  <td className="p-2 text-right">{money(s.gcash_fund)}</td>
                  <td className="p-2 text-right">{money(todayStats(s).profit_today)}</td>
                  <td className="p-2">
                    {fmtDate(nextDueDate({ trial_end: toDate(s.trial_end) ?? new Date(0), subscription_end: toDate(s.subscription_end), deactivated: s.deactivated }))}
                  </td>
                  <td className="p-2">
                    <Link to={`/admin/stores/${s.id}`} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
