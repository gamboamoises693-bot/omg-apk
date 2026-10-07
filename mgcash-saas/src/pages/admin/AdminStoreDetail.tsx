import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAdmin } from "./AdminContext";
import { todayStats } from "../../services/stores";
import { watchTinderas } from "../../services/tinderas";
import { watchTxnsSince } from "../../services/transactions";
import { extendTrial, markPaidManual, reminderMessage, setDeactivated } from "../../services/payments";
import { resetUserPassword } from "../../services/admin";
import { addDays, nextDueDate } from "../../lib/subscription";
import { fmtDate, fmtDateTime, money, startOfManilaDay } from "../../lib/format";
import { toDate } from "../../lib/dates";
import { Alert, Badge, Button, Card, Field, Modal, PageTitle, Stat, copyText } from "../../components/ui";
import { SubStatusBadge } from "../../components/StatusBadge";
import { PhotoCapture } from "../../components/PhotoCapture";
import { StoreReport } from "../owner/OwnerReports";
import type { Store, Tindera, Transaction } from "../../lib/types";

/** Read-only support view of one store + subscription actions. */
export default function AdminStoreDetail() {
  const { id = "" } = useParams();
  const { stores, payments, config } = useAdmin();
  const store = stores.find((s) => s.id === id);
  const [tinderas, setTinderas] = useState<Tindera[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    const u = [watchTinderas(id, setTinderas), watchTxnsSince(id, addDays(startOfManilaDay(), -6), setTxns)];
    return () => u.forEach((x) => x());
  }, [id]);

  const perf = useMemo(() => {
    const today = startOfManilaDay().getTime();
    const m = new Map<string, { today: number; week: number; count: number }>();
    for (const t of txns) {
      if (t.status !== "approved") continue;
      const r = m.get(t.tindera_id) ?? { today: 0, week: 0, count: 0 };
      r.week += t.commission;
      r.count++;
      if ((toDate(t.created_at)?.getTime() ?? 0) >= today) r.today += t.commission;
      m.set(t.tindera_id, r);
    }
    return m;
  }, [txns]);

  if (!store) return <Alert>Store not found.</Alert>;

  const storePayments = payments.filter((p) => p.store_id === store.id);
  const due = nextDueDate({ trial_end: toDate(store.trial_end) ?? new Date(), subscription_end: toDate(store.subscription_end), deactivated: store.deactivated });
  const reminder = reminderMessage(store, config.admin_gcash, config.monthly_price, due);
  const stats = todayStats(store);

  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "green", text: ok });
    } catch (e) {
      setMsg({ tone: "red", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Link to="/admin/stores" className="text-sm font-semibold text-brand">
        ← All Stores
      </Link>
      <PageTitle right={<SubStatusBadge status={store.status} />}>{store.store_name}</PageTitle>

      <Card className="grid grid-cols-2 gap-2 text-sm">
        <div>Owner: <b>{store.owner_name}</b></div>
        <div>Phone: <b>{store.owner_phone}</b></div>
        <div>Location: <b>{store.address}</b></div>
        <div>Code: <b>{store.store_code}</b></div>
        <div>Business GCash: <b>{store.gcash_number_for_business}</b></div>
        <div>Owner GCash: <b>{store.owner_gcash}</b></div>
        <div>Trial End: <b>{fmtDate(toDate(store.trial_end))}</b></div>
        <div>Sub. End: <b>{fmtDate(toDate(store.subscription_end))}</b></div>
        <div>Next Due: <b>{fmtDate(due)}</b></div>
        <div>Referred by: <b>{store.referred_by ? stores.find((s) => s.id === store.referred_by)?.store_name ?? "?" : "-"}</b></div>
      </Card>

      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Button variant="accent" loading={busy === "trial"} onClick={() => void run("trial", () => extendTrial(store, 7), "Na-extend ang trial +7 days.")}>
          Extend Trial +7d
        </Button>
        <Button variant="success" onClick={() => setPayOpen(true)}>
          Mark as Paid
        </Button>
        <Button
          variant={store.deactivated ? "primary" : "danger"}
          loading={busy === "deact"}
          onClick={() => {
            if (!store.deactivated && !confirm(`I-deactivate ang ${store.store_name}? Mala-lock ang Boss at Tindera app.`)) return;
            void run("deact", () => setDeactivated(store.id, !store.deactivated), store.deactivated ? "Na-reactivate." : "Na-deactivate.");
          }}
        >
          {store.deactivated ? "Reactivate" : "Deactivate"}
        </Button>
        <Button variant="ghost" onClick={() => setPwOpen(true)}>
          Reset Password
        </Button>
      </div>

      <Card className="space-y-2">
        <h2 className="font-bold text-brand">GCash Reminder</h2>
        <p className="rounded-lg bg-slate-50 p-2 text-sm">{reminder}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => void copyText(reminder).then(() => setMsg({ tone: "green", text: "Na-copy ang message." }))}>
            Copy Message
          </Button>
          <a className="btn bg-brand text-white" href={`sms:${store.owner_phone}?body=${encodeURIComponent(reminder)}`}>
            Send SMS
          </a>
        </div>
      </Card>

      <h2 className="text-lg font-bold text-brand">Store Profit (read-only)</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Profit Today" value={money(stats.profit_today)} tone="green" />
        <Stat label="GCash Fund" value={money(store.gcash_fund)} />
        <Stat label="Cash Float" value={money(store.cash_float)} tone="accent" />
        <Stat label="Txns Today" value={stats.txn_today} />
      </div>
      <StoreReport storeId={store.id} />

      <Card>
        <h2 className="mb-2 font-bold text-brand">Tindera Performance (7 days)</h2>
        {tinderas.length === 0 ? <p className="text-sm text-slate-500">Walang tindera.</p> : null}
        <ul className="divide-y text-sm">
          {tinderas.map((t) => {
            const p = perf.get(t.id);
            return (
              <li key={t.id} className="flex justify-between py-2">
                <span>
                  {t.name} <Badge tone={t.active ? "green" : "slate"}>{t.active ? "active" : "off"}</Badge>
                  <span className="block text-xs text-slate-500">{p?.count ?? 0} txns · today {money(p?.today)}</span>
                </span>
                <b>{money(p?.week)}</b>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-2 font-bold text-brand">Payment History</h2>
        <ul className="divide-y text-sm">
          {storePayments.map((p) => (
            <li key={p.id} className="flex justify-between py-2">
              <span>
                {money(p.amount)} · Ref {p.gcash_ref || "-"}
                <span className="block text-xs text-slate-500">
                  {fmtDateTime(toDate(p.created_at))} · {p.source === "admin_manual" ? "manual" : "upload"}
                </span>
              </span>
              <Badge tone={p.status === "paid" ? "green" : p.status === "pending" ? "yellow" : "red"}>{p.status}</Badge>
            </li>
          ))}
          {storePayments.length === 0 ? <li className="py-2 text-slate-500">Wala pa.</li> : null}
        </ul>
      </Card>

      <MarkPaidModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        onDone={(t) => setMsg({ tone: "green", text: t })}
        store={store}
        price={config.monthly_price}
        dailyPrice={config.daily_price}
      />
      <ResetPwModal open={pwOpen} onClose={() => setPwOpen(false)} uid={store.owner_uid} onDone={(t) => setMsg({ tone: "green", text: t })} />
    </div>
  );
}

function MarkPaidModal({
  open,
  onClose,
  onDone,
  store,
  price,
  dailyPrice,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (t: string) => void;
  store: Store;
  price: number;
  dailyPrice: number;
}) {
  const [amount, setAmount] = useState(String(price));
  const [ref, setRef] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [b, setB] = useState(false);
  const [e, setE] = useState<string | null>(null);
  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return setE("Invalid amount.");
    setB(true);
    try {
      await markPaidManual(store, amt, ref, proof ?? undefined, { monthly: price, daily: dailyPrice });
      onDone(`Paid ₱${amt}. Na-extend ang subscription.`);
      onClose();
    } catch (er) {
      setE((er as Error).message);
    } finally {
      setB(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Mark as Paid">
      <div className="space-y-3">
        <Field label="Amount (₱)" type="number" value={amount} onChange={(ev) => setAmount(ev.target.value)} hint={`₱${price} = 30 days; iba = ₱${dailyPrice}/day`} />
        <Field label="GCash Reference" value={ref} onChange={(ev) => setRef(ev.target.value)} />
        <PhotoCapture value={proof} onChange={setProof} label="Upload Screenshot (optional)" facing="environment" />
        {e ? <Alert>{e}</Alert> : null}
        <Button variant="success" className="w-full" loading={b} onClick={() => void submit()}>
          Confirm Paid
        </Button>
      </div>
    </Modal>
  );
}

function ResetPwModal({ open, onClose, uid, onDone }: { open: boolean; onClose: () => void; uid: string; onDone: (t: string) => void }) {
  const [pw, setPw] = useState("");
  const [b, setB] = useState(false);
  const [e, setE] = useState<string | null>(null);
  const submit = async () => {
    if (pw.length < 6) return setE("6 characters pataas.");
    setB(true);
    try {
      await resetUserPassword(uid, pw);
      onDone("Na-reset ang password ng owner. Ipadala sa kanya ang bagong password.");
      setPw("");
      onClose();
    } catch (er) {
      setE((er as Error).message);
    } finally {
      setB(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Reset Owner Password">
      <div className="space-y-3">
        <Field label="Bagong Password" value={pw} onChange={(ev) => setPw(ev.target.value)} />
        {e ? <Alert>{e}</Alert> : null}
        <Button className="w-full" loading={b} onClick={() => void submit()}>
          Reset
        </Button>
      </div>
    </Modal>
  );
}
