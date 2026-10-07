import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../context/StoreContext";
import { todayStats } from "../../services/stores";
import { watchPending, watchTxnsSince } from "../../services/transactions";
import { watchShiftsSince } from "../../services/shifts";
import { fmtDateTime, money, startOfManilaDay } from "../../lib/format";
import { toDate } from "../../lib/dates";
import { TXN_LABEL } from "../../lib/fees";
import { Alert, Card, Empty, PageTitle, Stat } from "../../components/ui";
import { TxnStatusBadge } from "../../components/StatusBadge";
import type { Shift, Transaction } from "../../lib/types";

export default function OwnerDashboard() {
  const { store } = useStore();
  const [today, setToday] = useState<Transaction[]>([]);
  const [pending, setPending] = useState<Transaction[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  useEffect(() => {
    if (!store) return;
    const since = startOfManilaDay();
    const u = [
      watchTxnsSince(store.id, since, setToday),
      watchPending(store.id, setPending),
      watchShiftsSince(store.id, since, setShifts),
    ];
    return () => u.forEach((x) => x());
  }, [store]);

  const alerts = useMemo(() => {
    if (!store) return [];
    const a: { tone: "red" | "yellow"; text: string }[] = [];
    for (const s of shifts) {
      if (s.status === "closed" && (s.shortage ?? 0) > 0 && s.audit_status === "pending") {
        a.push({ tone: "red", text: `${s.tindera_name} kulang ${money(s.shortage)} sa shift. I-review sa Audit.` });
      }
    }
    if (store.gcash_fund < store.low_fund_threshold) a.push({ tone: "yellow", text: `Mababa na ang GCash fund (${money(store.gcash_fund)}). Mag-top up.` });
    if (store.cash_float < 0) a.push({ tone: "red", text: "Negative ang cash float. I-update sa Settings." });
    if (pending.length) a.push({ tone: "yellow", text: `${pending.length} transaction ang naghihintay ng approval mo.` });
    return a;
  }, [store, shifts, pending]);

  if (!store) return null;
  const stats = todayStats(store);

  return (
    <div className="space-y-4">
      <PageTitle>Dashboard Ngayon</PageTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Profit Today" value={money(stats.profit_today)} tone="green" />
        <Stat label="GCash Fund" value={money(store.gcash_fund)} />
        <Stat label="Cash Float" value={money(store.cash_float)} tone="accent" />
        <Stat label="Tindera Commission" value={money(stats.commission_today)} />
        <Stat label="Transactions" value={stats.txn_today} sub="approved today" />
        <Link to="/owner/approvals">
          <Stat label="Pending Approvals" value={pending.length} tone={pending.length ? "red" : "brand"} sub="tap para i-approve" />
        </Link>
      </div>

      {alerts.length ? (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <Alert key={i} tone={a.tone}>
              ⚠️ {a.text}
            </Alert>
          ))}
        </div>
      ) : null}

      <Card>
        <h2 className="mb-2 font-bold text-brand">Transactions Ngayon</h2>
        {today.length === 0 ? (
          <Empty>Wala pang transaction ngayon.</Empty>
        ) : (
          <ul className="divide-y">
            {today.slice(0, 30).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <b>{TXN_LABEL[t.type]}</b> {money(t.amount)} · {t.customer_number || "—"}
                  <div className="text-xs text-slate-500">
                    {t.tindera_name} · {fmtDateTime(toDate(t.created_at))}
                  </div>
                </div>
                <TxnStatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
