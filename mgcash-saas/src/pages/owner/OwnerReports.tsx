import { useEffect, useState } from "react";
import { useStore } from "../../context/StoreContext";
import { fetchApprovedBetween } from "../../services/transactions";
import { buildReport, rangeStart, type ReportRange, type ReportRow } from "../../lib/reports";
import { money } from "../../lib/format";
import { toDate } from "../../lib/dates";
import { Alert, Button, Card, Empty, PageTitle, Spinner, Stat } from "../../components/ui";

/** Owner's own store report page. */
export default function OwnerReports() {
  const { store } = useStore();
  if (!store) return null;
  return (
    <div className="space-y-3">
      <PageTitle>Reports</PageTitle>
      <StoreReport storeId={store.id} />
    </div>
  );
}

/** Profit report for one store (daily 14d / weekly 8w / monthly 6m). Also used read-only by Super Admin. */
export function StoreReport({ storeId }: { storeId: string }) {
  const [range, setRange] = useState<ReportRange>("daily");
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    setErr(null);
    fetchApprovedBetween(storeId, rangeStart(range), new Date(Date.now() + 60_000))
      .then((t) => setRows(buildReport(t, range, (x) => toDate(x.created_at))))
      .catch((e) => setErr((e as Error).message));
  }, [storeId, range]);

  const total = (rows ?? []).reduce(
    (a, r) => ({ profit: a.profit + r.profit, count: a.count + r.count, fees: a.fees + r.fees, commission: a.commission + r.commission }),
    { profit: 0, count: 0, fees: 0, commission: 0 },
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {(["daily", "weekly", "monthly"] as const).map((r) => (
          <Button key={r} variant={range === r ? "primary" : "ghost"} onClick={() => setRange(r)}>
            {r === "daily" ? "Daily" : r === "weekly" ? "Weekly" : "Monthly"}
          </Button>
        ))}
      </div>
      {err ? <Alert>{err}</Alert> : null}
      {!rows ? (
        <div className="flex justify-center p-6 text-brand">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Total Profit" value={money(total.profit)} tone="green" />
            <Stat label="Transactions" value={total.count} />
            <Stat label="Total Fees" value={money(total.fees)} />
            <Stat label="Tindera Commission" value={money(total.commission)} tone="accent" />
          </div>
          {rows.length === 0 ? (
            <Empty>Walang approved transaction sa range na ito.</Empty>
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-brand-light text-left text-xs text-brand">
                  <tr>
                    <th className="p-2">Period</th>
                    <th className="p-2 text-right">Txns</th>
                    <th className="p-2 text-right">Cash In</th>
                    <th className="p-2 text-right">Cash Out</th>
                    <th className="p-2 text-right">Load</th>
                    <th className="p-2 text-right">Comm.</th>
                    <th className="p-2 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td className="p-2 font-semibold">{r.label}</td>
                      <td className="p-2 text-right">{r.count}</td>
                      <td className="p-2 text-right">{money(r.cash_in)}</td>
                      <td className="p-2 text-right">{money(r.cash_out)}</td>
                      <td className="p-2 text-right">{money(r.load)}</td>
                      <td className="p-2 text-right">{money(r.commission)}</td>
                      <td className="p-2 text-right font-bold text-emerald-600">{money(r.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
