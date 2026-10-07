import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useStore } from "../../context/StoreContext";
import { watchMyTxnsSince } from "../../services/transactions";
import { periodFor } from "../../services/payroll";
import { addDays } from "../../lib/subscription";
import { fmtDate, manilaDay, money, startOfManilaDay } from "../../lib/format";
import { toDate } from "../../lib/dates";
import { Card, PageTitle, Stat } from "../../components/ui";
import { ChangePassword } from "../owner/OwnerSettings";
import type { Payroll, Transaction } from "../../lib/types";

export default function MyCommission() {
  const { store, me } = useStore();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [payrolls, setPayrolls] = useState<(Payroll & { period_label?: string })[]>([]);

  useEffect(() => {
    if (!store || !me) return;
    const u = [
      watchMyTxnsSince(store.id, me.id, addDays(startOfManilaDay(), -31), setTxns),
      // Rules allow a tindera to read only payroll docs with her own tindera_id.
      onSnapshot(query(collection(db, "stores", store.id, "payrolls"), where("tindera_id", "==", me.id)), (snap) =>
        setPayrolls(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Payroll, "id">) }))
            .sort((a, b) => (toDate(b.created_at)?.getTime() ?? 0) - (toDate(a.created_at)?.getTime() ?? 0)),
        ),
      ),
    ];
    return () => u.forEach((x) => x());
  }, [store, me]);

  const s = useMemo(() => {
    const today = manilaDay();
    const period = periodFor(new Date(), "semi");
    const byDay = new Map<string, { commission: number; count: number }>();
    let todayC = 0;
    let periodC = 0;
    for (const t of txns) {
      if (t.status !== "approved") continue;
      const d = toDate(t.created_at);
      if (!d) continue;
      const day = manilaDay(d);
      const row = byDay.get(day) ?? { commission: 0, count: 0 };
      row.commission += t.commission;
      row.count++;
      byDay.set(day, row);
      if (day === today) todayC += t.commission;
      if (d >= period.from) periodC += t.commission;
    }
    return { todayC, periodC, periodLabel: period.label, days: [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])) };
  }, [txns]);

  if (!me) return null;

  return (
    <div className="space-y-4">
      <PageTitle>Commission Ko</PageTitle>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Today" value={money(s.todayC)} tone="green" />
        <Stat label={`Cutoff (${s.periodLabel})`} value={money(s.periodC)} />
      </div>
      <Card className="text-sm text-slate-600">
        Rate: {money(me.commission_cash)} / Cash In-Out · {money(me.commission_load)} / Load · Base {money(me.base_salary)}/mo · Bonus {money(me.bonus)}
      </Card>
      <Card>
        <h2 className="mb-2 font-bold text-brand">Per Araw (31 days)</h2>
        <ul className="divide-y text-sm">
          {s.days.map(([day, r]) => (
            <li key={day} className="flex justify-between py-2">
              <span>
                {fmtDate(new Date(`${day}T12:00:00+08:00`))} <span className="text-xs text-slate-500">({r.count} txns)</span>
              </span>
              <b className="text-emerald-600">{money(r.commission)}</b>
            </li>
          ))}
          {s.days.length === 0 ? <li className="py-2 text-slate-500">Wala pa.</li> : null}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-2 font-bold text-brand">Payslip</h2>
        <ul className="divide-y text-sm">
          {payrolls.map((p) => (
            <li key={p.id} className="py-2">
              <div className="flex justify-between">
                <b>{p.period_label ?? fmtDate(toDate(p.period_start))}</b>
                <b className="text-emerald-600">{money(p.net)}</b>
              </div>
              <div className="text-xs text-slate-500">
                Base {money(p.base)} + Comm {money(p.commission)} + Bonus {money(p.bonus)} − Deduct {money(p.deductions)}
              </div>
            </li>
          ))}
          {payrolls.length === 0 ? <li className="py-2 text-slate-500">Wala pang payslip.</li> : null}
        </ul>
      </Card>
      <ChangePassword />
    </div>
  );
}
