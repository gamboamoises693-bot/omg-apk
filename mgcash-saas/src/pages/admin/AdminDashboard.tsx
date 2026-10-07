import { Link } from "react-router-dom";
import { useAdmin } from "./AdminContext";
import { todayStats } from "../../services/stores";
import { manilaDay, money } from "../../lib/format";
import { toDate } from "../../lib/dates";
import { Alert, Card, PageTitle, Spinner, Stat } from "../../components/ui";
import { SubStatusBadge } from "../../components/StatusBadge";

export default function AdminDashboard() {
  const { stores, payments, config, loading, error } = useAdmin();
  if (loading) return <div className="flex justify-center p-8 text-brand"><Spinner /></div>;

  const count = (st: string) => stores.filter((s) => s.status === st).length;
  const active = count("active") + count("overdue");
  const today = manilaDay();
  const endsToday = (d: Date | null) => !!d && manilaDay(d) === today;

  const expiredToday = stores.filter(
    (s) => (s.status === "expired" || s.status === "overdue") && (endsToday(toDate(s.trial_end)) || endsToday(toDate(s.subscription_end))),
  );
  const endingSoon = stores.filter((s) => {
    const end = toDate(s.subscription_end) ?? toDate(s.trial_end);
    return (s.status === "active" || s.status === "trial") && end && end.getTime() - Date.now() < 3 * 86_400_000;
  });
  const lowFund = stores.filter((s) => s.status !== "deactivated" && s.gcash_fund < s.low_fund_threshold);
  const pendingPay = payments.filter((p) => p.status === "pending");
  const totalFunds = stores.reduce((a, s) => a + s.gcash_fund, 0);
  const profitToday = stores.reduce((a, s) => a + todayStats(s).profit_today, 0);
  const paidThisMonth = payments
    .filter((p) => p.status === "paid" && manilaDay(toDate(p.paid_at ?? null) ?? new Date(0)).slice(0, 7) === today.slice(0, 7))
    .reduce((a, p) => a + p.amount, 0);

  return (
    <div className="space-y-4">
      <PageTitle>Dashboard</PageTitle>
      {error ? <Alert>{error}</Alert> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active Stores" value={active} tone="green" sub={`${count("overdue")} overdue`} />
        <Stat label="Trial" value={count("trial")} tone="accent" />
        <Stat label="Expired" value={count("expired")} tone="red" sub={`${count("deactivated")} deactivated`} />
        <Stat label="MRR" value={money(active * config.monthly_price)} sub={`${active} × ₱${config.monthly_price}`} />
        <Stat label="Collected this month" value={money(paidThisMonth)} tone="green" />
        <Stat label="GCash Funds Managed" value={money(totalFunds)} sub="lahat ng stores" />
        <Stat label="Profit Today (all stores)" value={money(profitToday)} />
        <Stat label="Pending Payments" value={pendingPay.length} tone={pendingPay.length ? "red" : "brand"} />
      </div>

      <Card className="space-y-2">
        <h2 className="font-bold text-brand">Alerts</h2>
        {expiredToday.length + endingSoon.length + lowFund.length + pendingPay.length === 0 ? (
          <p className="text-sm text-slate-500">Walang alert. 👍</p>
        ) : null}
        {pendingPay.length ? (
          <Link to="/admin/billing" className="block">
            <Alert tone="yellow">💳 {pendingPay.length} payment proof ang naghihintay ng approval.</Alert>
          </Link>
        ) : null}
        {expiredToday.map((s) => (
          <Link key={s.id} to={`/admin/stores/${s.id}`} className="block">
            <Alert>⛔ {s.store_name} nag-expire ngayong araw.</Alert>
          </Link>
        ))}
        {endingSoon.map((s) => (
          <Link key={s.id} to={`/admin/stores/${s.id}`} className="block">
            <Alert tone="yellow">
              ⏰ {s.store_name} mag-e-expire within 3 days <SubStatusBadge status={s.status} />
            </Alert>
          </Link>
        ))}
        {lowFund.map((s) => (
          <Link key={s.id} to={`/admin/stores/${s.id}`} className="block">
            <Alert tone="blue">💸 {s.store_name} low GCash fund: {money(s.gcash_fund)}</Alert>
          </Link>
        ))}
      </Card>
    </div>
  );
}
