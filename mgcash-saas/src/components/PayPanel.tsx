import { useEffect, useState, type FormEvent } from "react";
import { useStore } from "../context/StoreContext";
import { submitPaymentProof, watchStorePayments } from "../services/payments";
import { fmtDate, money } from "../lib/format";
import { toDate } from "../lib/dates";
import { Alert, Badge, Button, Card, Field, copyText } from "./ui";
import { PhotoCapture } from "./PhotoCapture";
import type { Payment } from "../lib/types";

/** GCash payment instructions + screenshot upload. Proof goes to Super Admin for approval. */
export function PayPanel() {
  const { store, config } = useStore();
  const [amount, setAmount] = useState(String(config.monthly_price));
  const [gcashRef, setGcashRef] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => (store ? watchStorePayments(store.id, setPayments) : undefined), [store]);

  if (!store) return null;
  const pending = payments.find((p) => p.status === "pending");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt < config.daily_price) return setMsg({ tone: "red", text: `Minimum ₱${config.daily_price}.` });
    if (!gcashRef.trim()) return setMsg({ tone: "red", text: "Ilagay ang GCash reference number." });
    if (!proof) return setMsg({ tone: "red", text: "Mag-upload ng screenshot ng GCash receipt." });
    setBusy(true);
    setMsg(null);
    try {
      await submitPaymentProof(store, amt, gcashRef, proof);
      setMsg({ tone: "green", text: "Naipadala! Hintayin ang approval ni Moises (karaniwan within the day)." });
      setGcashRef("");
      setProof(null);
    } catch (err) {
      setMsg({ tone: "red", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card className="border-2 border-accent">
        <div className="text-sm text-slate-600">Magpadala ng</div>
        <div className="text-3xl font-black text-brand">₱{config.monthly_price} / month</div>
        <div className="text-sm text-slate-600">o ₱{config.daily_price}/day</div>
        <div className="mt-3 rounded-xl bg-brand-light p-3">
          <div className="text-xs text-slate-500">GCash ni {config.admin_name}</div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black tracking-wider text-brand">{config.admin_gcash}</span>
            <Button variant="accent" className="min-h-9 px-3 text-sm" onClick={() => void copyText(config.admin_gcash)}>
              Copy
            </Button>
          </div>
          <div className="mt-1 text-xs text-slate-600">
            Message/Reference: <b>{store.store_name}</b>
          </div>
        </div>
      </Card>

      {pending ? (
        <Alert tone="yellow">
          May pending payment ka (₱{pending.amount}, ref {pending.gcash_ref}) na sinusuri pa ni Moises.
        </Alert>
      ) : null}

      <Card>
        <form onSubmit={submit} className="space-y-3">
          <h3 className="font-bold text-brand">I-upload ang Proof of Payment</h3>
          <Field label="Amount na pinadala (₱)" type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Field label="GCash Reference No." value={gcashRef} onChange={(e) => setGcashRef(e.target.value)} placeholder="e.g. 1234 567 890123" />
          <PhotoCapture value={proof} onChange={setProof} label="Upload GCash Screenshot" facing="environment" />
          {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
          <Button type="submit" className="w-full" loading={busy}>
            Ipadala ang Proof
          </Button>
        </form>
      </Card>

      {payments.length ? (
        <Card>
          <h3 className="mb-2 font-bold text-brand">Payment History</h3>
          <ul className="divide-y">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {money(p.amount)} · {fmtDate(toDate(p.created_at))}
                  <span className="block text-xs text-slate-500">Ref {p.gcash_ref || "-"}</span>
                </span>
                <Badge tone={p.status === "paid" ? "green" : p.status === "pending" ? "yellow" : "red"}>{p.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
