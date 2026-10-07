import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useStore } from "../../context/StoreContext";
import { useShift } from "./TinderaLayout";
import { cancelTxn, createTxn, watchTxn } from "../../services/transactions";
import { computeFee, TXN_LABEL } from "../../lib/fees";
import { money } from "../../lib/format";
import { toDate } from "../../lib/dates";
import { BluetoothKeypad } from "../../components/BluetoothKeypad";
import { PhoneDisplay } from "../../components/NumberPad";
import { Alert, Button, Card, Field, LockedBadge, PageTitle, copyText } from "../../components/ui";
import { TxnStatusBadge } from "../../components/StatusBadge";
import type { NumberSource, Transaction, TxnType } from "../../lib/types";

const QR_TTL_MS = 15 * 60_000; // must match firestore.rules

/** Customer-Type Mode: the CUSTOMER enters the GCash number (QR on own phone or BT keypad). */
export default function NewTransaction({ type }: { type: TxnType }) {
  const { store, me } = useStore();
  const shift = useShift();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<NumberSource | null>(null);
  const [txnId, setTxnId] = useState<string | null>(null);
  const [txn, setTxn] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => (store && txnId ? watchTxn(store.id, txnId, setTxn) : undefined), [store, txnId]);

  useEffect(() => {
    if (mode !== "qr" || !txnId) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [mode, txnId]);

  const amt = Number(amount);
  const fee = store ? computeFee(type, amt, store) : 0;

  const onKeypadLocked = useCallback(
    async (num: string) => {
      if (!store || !me || !shift) return;
      setBusy(true);
      setErr(null);
      try {
        setTxnId(await createTxn({ store, tindera: me, shiftId: shift.id, type, amount: amt, source: "keypad", customerNumber: num }));
      } catch (e) {
        setErr((e as Error).message);
        setMode(null);
      } finally {
        setBusy(false);
      }
    },
    [store, me, shift, type, amt],
  );

  if (!store || !me || !shift) return null;

  const startQr = async () => {
    setBusy(true);
    setErr(null);
    try {
      setTxnId(await createTxn({ store, tindera: me, shiftId: shift.id, type, amount: amt, source: "qr" }));
      setMode("qr");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setAmount("");
    setMode(null);
    setTxnId(null);
    setTxn(null);
    setErr(null);
  };

  const cancel = async () => {
    if (txnId && txn && (txn.status === "awaiting_number" || txn.status === "pending")) {
      await cancelTxn(store.id, txnId).catch(() => undefined);
    }
    reset();
  };

  const amountOk = Number.isFinite(amt) && amt > 0;
  const customerPays = type === "cash_out" ? `Ibibigay na cash: ${money(amt - fee)}` : `Singilin sa customer: ${money(amt + fee)}`;

  // ---------- Step 3: result / waiting for Boss ----------
  if (txn && txn.number_status === "locked") {
    return (
      <div className="space-y-3">
        <PageTitle>{TXN_LABEL[type]}</PageTitle>
        <Card className="space-y-3 text-center">
          <div className="text-3xl font-black text-brand">{money(txn.amount)}</div>
          <PhoneDisplay value={txn.customer_number} locked />
          <LockedBadge />
          <div>
            <TxnStatusBadge status={txn.status} />
          </div>
          {txn.status === "pending" ? <p className="text-slate-600">Naipadala kay Boss. Hintayin ang approval...</p> : null}
          {txn.status === "approved" ? (
            <Alert tone="green">
              {type === "cash_out" ? `✅ Approved! Ibigay ang ${money(txn.amount - txn.fee)} na cash sa customer.` : "✅ Approved! Na-send na ni Boss. Salamat sa customer!"}
              <div className="mt-1 font-bold">+{money(txn.commission)} commission mo</div>
            </Alert>
          ) : null}
          {txn.status === "rejected" ? <Alert>❌ Rejected ni Boss. {txn.reject_reason}</Alert> : null}
          {txn.status === "cancelled" ? <Alert tone="yellow">Cancelled.</Alert> : null}
          <div className="grid grid-cols-2 gap-2">
            {txn.status === "pending" ? (
              <Button variant="ghost" onClick={() => void cancel()}>
                Cancel
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={reset}>Bagong Transaction</Button>
          </div>
        </Card>
      </div>
    );
  }

  // ---------- Step 2a: QR waiting for customer ----------
  if (mode === "qr" && txnId) {
    const url = `${window.location.origin}/customer-type?store_id=${encodeURIComponent(store.id)}&trans_id=${encodeURIComponent(txnId)}`;
    const created = txn ? toDate(txn.created_at)?.getTime() ?? now : now;
    const left = Math.max(0, created + QR_TTL_MS - now);
    return (
      <div className="space-y-3">
        <PageTitle>{TXN_LABEL[type]} · QR</PageTitle>
        <Card className="space-y-3 text-center">
          <p className="font-semibold">Ipa-scan sa customer gamit ang SARILI niyang phone:</p>
          <div className="mx-auto w-fit rounded-xl bg-white p-3 shadow">
            <QRCodeSVG value={url} size={240} level="M" />
          </div>
          <div className="text-2xl font-black text-brand">{money(amt)}</div>
          <p className="text-sm text-slate-600">{customerPays}</p>
          <p className={`text-sm font-semibold ${left < 60_000 ? "text-red-600" : "text-slate-500"}`}>
            {left > 0 ? `Valid pa ng ${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}` : "Expired na ang QR"}
          </p>
          <p className="animate-pulse text-sm">⏳ Hinihintay ang number ng customer...</p>
          {/* Fallback when the customer's camera can't scan: share the link via Messenger/SMS. */}
          <button type="button" data-testid="customer-link" data-url={url} className="text-sm font-semibold text-brand underline" onClick={() => void copyText(url)}>
            Hindi ma-scan? Copy link para sa customer
          </button>
          <Button variant="ghost" className="w-full" onClick={() => void cancel()}>
            Cancel
          </Button>
        </Card>
      </div>
    );
  }

  // ---------- Step 2b: Bluetooth keypad ----------
  if (mode === "keypad") {
    return (
      <div className="space-y-3">
        <PageTitle>{TXN_LABEL[type]} · Keypad</PageTitle>
        <Card className="space-y-3">
          <div className="text-center text-2xl font-black text-brand">{money(amt)}</div>
          <BluetoothKeypad onLocked={(n) => void onKeypadLocked(n)} disabled={busy} />
          {err ? <Alert>{err}</Alert> : null}
          <Button variant="ghost" className="w-full" onClick={reset}>
            Cancel
          </Button>
        </Card>
      </div>
    );
  }

  // ---------- Step 1: amount + mode ----------
  return (
    <div className="space-y-3">
      <PageTitle>{TXN_LABEL[type]}</PageTitle>
      <Card className="space-y-3">
        <Field label="Amount (₱)" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        <div className="grid grid-cols-4 gap-2">
          {(type === "load" ? [20, 50, 100, 300] : [500, 1000, 2000, 5000]).map((v) => (
            <button key={v} type="button" className="btn bg-brand-light px-1 text-brand" onClick={() => setAmount(String(v))}>
              {v}
            </button>
          ))}
        </div>
        {amountOk ? (
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <div className="flex justify-between">
              <span>Fee</span>
              <b>{money(fee)}</b>
            </div>
            <div className="flex justify-between text-base">
              <span>{type === "cash_out" ? "Ibibigay na cash" : "Singilin sa customer"}</span>
              <b className="text-brand">{money(type === "cash_out" ? amt - fee : amt + fee)}</b>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Commission mo</span>
              <b>{money(type === "load" ? me.commission_load : me.commission_cash)}</b>
            </div>
          </div>
        ) : null}
        {type === "cash_out" && amountOk && amt - fee <= 0 ? <Alert>Mas malaki ang fee kaysa amount.</Alert> : null}
        {err ? <Alert>{err}</Alert> : null}
        <p className="text-sm font-semibold text-slate-600">Paano ita-type ng customer ang GCash number?</p>
        <div className="grid grid-cols-2 gap-2">
          <Button disabled={!amountOk || (type === "cash_out" && amt - fee <= 0)} loading={busy} onClick={() => void startQr()}>
            📱 QR (phone ng customer)
          </Button>
          <Button variant="accent" disabled={!amountOk || (type === "cash_out" && amt - fee <= 0)} onClick={() => setMode("keypad")}>
            ⌨️ Bluetooth Keypad
          </Button>
        </div>
      </Card>
    </div>
  );
}
