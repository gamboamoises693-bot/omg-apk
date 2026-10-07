import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../context/StoreContext";
import { useShift } from "./TinderaLayout";
import { cancelTxn, watchMyTxnsSince } from "../../services/transactions";
import { fmtDateTime, money, startOfManilaDay } from "../../lib/format";
import { toDate } from "../../lib/dates";
import { TXN_LABEL } from "../../lib/fees";
import { Button, Card, Empty, Stat } from "../../components/ui";
import { TxnStatusBadge } from "../../components/StatusBadge";
import type { Transaction } from "../../lib/types";

/** Tindera sees only her commission + her own txns (no store profit / fund). */
export default function TinderaDashboard() {
  const { store, me } = useStore();
  const shift = useShift();
  const [txns, setTxns] = useState<Transaction[]>([]);

  useEffect(() => (store && me ? watchMyTxnsSince(store.id, me.id, startOfManilaDay(), setTxns) : undefined), [store, me]);

  const s = useMemo(() => {
    const approved = txns.filter((t) => t.status === "approved");
    return {
      commission: approved.reduce((a, t) => a + t.commission, 0),
      count: approved.length,
      pending: txns.filter((t) => t.status === "pending" || t.status === "awaiting_number").length,
    };
  }, [txns]);

  if (!store || !me) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Commission Ko Today" value={money(s.commission)} tone="green" />
        <Stat label="Approved Txns" value={s.count} sub={s.pending ? `${s.pending} pending kay Boss` : undefined} />
      </div>
      {shift ? (
        <p className="text-center text-xs text-slate-500">
          Shift mula {fmtDateTime(toDate(shift.start_at))} · Start cash {money(shift.start_cash)}
        </p>
      ) : null}
      <div className="grid grid-cols-3 gap-3">
        <Link to="/tindera/cash-in" className="btn min-h-24 flex-col bg-brand text-white">
          <span className="text-3xl">⬇️</span>Cash In
        </Link>
        <Link to="/tindera/cash-out" className="btn min-h-24 flex-col bg-accent text-slate-900">
          <span className="text-3xl">⬆️</span>Cash Out
        </Link>
        <Link to="/tindera/load" className="btn min-h-24 flex-col bg-emerald-600 text-white">
          <span className="text-3xl">📱</span>Load
        </Link>
      </div>
      <Card>
        <h2 className="mb-2 font-bold text-brand">Mga Transaction Ko Ngayon</h2>
        {txns.length === 0 ? (
          <Empty>Wala pa.</Empty>
        ) : (
          <ul className="divide-y">
            {txns.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <b>{TXN_LABEL[t.type]}</b> {money(t.amount)}
                  <div className="text-xs text-slate-500">
                    {t.customer_number || "naghihintay ng number"} · {fmtDateTime(toDate(t.created_at))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <TxnStatusBadge status={t.status} />
                  {t.status === "awaiting_number" || t.status === "pending" ? (
                    <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => void cancelTxn(store.id, t.id)}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
