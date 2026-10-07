import { useEffect, useState } from "react";
import { useStore } from "../../context/StoreContext";
import { watchTinderas } from "../../services/tinderas";
import { computeStorePayroll, periodFor, savePayroll, watchPayrolls, type PayrollPeriod, type PayrollRow } from "../../services/payroll";
import { fmtDate, money } from "../../lib/format";
import { toDate } from "../../lib/dates";
import { Alert, Badge, Button, Card, Empty, PageTitle, Spinner } from "../../components/ui";
import type { Payroll, Tindera } from "../../lib/types";

/** Auto-computed payroll: base + commission + bonus - audit deductions, per tindera. */
export default function OwnerPayroll() {
  const { store } = useStore();
  const [tinderas, setTinderas] = useState<Tindera[]>([]);
  const [cutoff, setCutoff] = useState<"semi" | "monthly">("semi");
  const [offset, setOffset] = useState(0); // 0 = current period, -1 = previous ...
  const [rows, setRows] = useState<PayrollRow[] | null>(null);
  const [history, setHistory] = useState<(Payroll & { period_label?: string })[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const period: PayrollPeriod = (() => {
    let p = periodFor(new Date(), cutoff);
    for (let i = 0; i > offset; i--) p = periodFor(new Date(p.from.getTime() - 1), cutoff);
    return p;
  })();

  useEffect(() => {
    if (!store) return;
    const u = [watchTinderas(store.id, setTinderas), watchPayrolls(store.id, setHistory)];
    return () => u.forEach((x) => x());
  }, [store]);

  useEffect(() => {
    if (!store) return;
    setRows(null);
    setErr(null);
    computeStorePayroll(store.id, tinderas, period)
      .then(setRows)
      .catch((e) => setErr((e as Error).message));
    // period is derived from cutoff+offset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id, tinderas, cutoff, offset]);

  if (!store) return null;

  const save = async (r: PayrollRow) => {
    setSavingId(r.tindera.id);
    try {
      await savePayroll(store.id, r, period);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const alreadyPaid = (tid: string) =>
    history.some((h) => h.tindera_id === tid && toDate(h.period_start)?.getTime() === period.from.getTime());

  return (
    <div className="space-y-3">
      <PageTitle>Payroll</PageTitle>
      <div className="grid grid-cols-2 gap-2">
        <Button variant={cutoff === "semi" ? "primary" : "ghost"} onClick={() => { setCutoff("semi"); setOffset(0); }}>
          Kinsenas (15 days)
        </Button>
        <Button variant={cutoff === "monthly" ? "primary" : "ghost"} onClick={() => { setCutoff("monthly"); setOffset(0); }}>
          Monthly
        </Button>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-white p-2">
        <Button variant="ghost" className="min-h-10 px-3" onClick={() => setOffset(offset - 1)}>
          ◀
        </Button>
        <b className="text-brand">{period.label}</b>
        <Button variant="ghost" className="min-h-10 px-3" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>
          ▶
        </Button>
      </div>
      {err ? <Alert>{err}</Alert> : null}
      {!rows ? (
        <div className="flex justify-center p-6 text-brand">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <Empty>Walang tindera.</Empty>
      ) : (
        rows.map((r) => (
          <Card key={r.tindera.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <b className="text-lg">{r.tindera.name}</b>
              <span className="text-2xl font-black text-emerald-600">{money(r.net)}</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr><td>Base Salary {cutoff === "semi" ? "(½)" : ""}</td><td className="text-right">{money(r.base)}</td></tr>
                <tr><td>Commission ({r.txn_count} txns)</td><td className="text-right">{money(r.commission)}</td></tr>
                <tr><td>Bonus</td><td className="text-right">{money(r.bonus)}</td></tr>
                <tr className="text-red-600"><td>Deductions ({r.shortage_count} kulang)</td><td className="text-right">-{money(r.deductions)}</td></tr>
              </tbody>
            </table>
            {alreadyPaid(r.tindera.id) ? (
              <Badge tone="green">Na-save / Bayad na ngayong period</Badge>
            ) : (
              <Button variant="success" className="w-full" loading={savingId === r.tindera.id} onClick={() => void save(r)}>
                Mark as Paid & Save
              </Button>
            )}
          </Card>
        ))
      )}

      <Card>
        <h2 className="mb-2 font-bold text-brand">Payroll History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">Wala pa.</p>
        ) : (
          <ul className="divide-y text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex justify-between py-2">
                <span>
                  {h.tindera_name}
                  <span className="block text-xs text-slate-500">{h.period_label ?? fmtDate(toDate(h.period_start))}</span>
                </span>
                <b>{money(h.net)}</b>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
