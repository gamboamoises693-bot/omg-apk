import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getTxnPublic, lockCustomerNumber } from "../../services/transactions";
import { NumberPad, PhoneDisplay } from "../../components/NumberPad";
import { Alert, Button, FullLoader, LockedBadge } from "../../components/ui";
import { PHONE_RE, money } from "../../lib/format";
import { TXN_LABEL } from "../../lib/fees";
import type { Transaction } from "../../lib/types";

/**
 * PUBLIC page (no login) opened by the CUSTOMER after scanning the tindera's QR.
 * Customer types own GCash number -> locked once -> sent to Boss for approval.
 * Security rules only allow a single lock within 15 minutes of txn creation.
 */
export default function CustomerType() {
  const [params] = useSearchParams();
  const storeId = params.get("store_id") ?? params.get("store") ?? "";
  const txnId = params.get("trans_id") ?? params.get("trans") ?? "";

  const [txn, setTxn] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [number, setNumber] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!storeId || !txnId) {
      setError("Invalid link. I-scan ulit ang QR sa tindahan.");
      setLoading(false);
      return;
    }
    getTxnPublic(storeId, txnId)
      .then((t) => {
        if (!t || t.number_status !== "waiting") setError("Nagamit na o expired na ang QR na ito. Humingi ng bagong QR.");
        else setTxn(t);
      })
      // Rules deny reads once the number is locked -> treat as used.
      .catch(() => setError("Nagamit na o expired na ang QR na ito. Humingi ng bagong QR."))
      .finally(() => setLoading(false));
  }, [storeId, txnId]);

  const lock = async () => {
    setBusy(true);
    setError(null);
    try {
      await lockCustomerNumber(storeId, txnId, number);
      setDone(true);
    } catch {
      setError("Hindi na-save. Baka expired na ang QR (15 mins). Humingi ng bagong QR sa tindera.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <FullLoader />;

  return (
    <div className="min-h-screen bg-brand-light">
      <header className="bg-brand px-4 py-4 text-center text-white">
        <div className="text-2xl font-black">
          MG<span className="text-accent">-CASH</span>
        </div>
        {txn ? <div className="text-sm text-white/80">{txn.store_name}</div> : null}
      </header>
      <main className="mx-auto max-w-sm space-y-4 p-4">
        {done ? (
          <div className="space-y-3 rounded-2xl bg-white p-6 text-center">
            <div className="text-5xl">✅</div>
            <PhoneDisplay value={number} locked />
            <LockedBadge />
            <p className="font-semibold text-slate-700">Naipadala na sa may-ari ng tindahan para i-approve. Salamat po!</p>
            <p className="text-sm text-slate-500">Pwede mo nang isara ang page na ito.</p>
          </div>
        ) : error && !txn ? (
          <Alert>{error}</Alert>
        ) : txn ? (
          <>
            <div className="rounded-2xl bg-white p-4 text-center">
              <div className="text-sm text-slate-500">{TXN_LABEL[txn.type]}</div>
              <div className="text-3xl font-black text-brand">{money(txn.amount)}</div>
              <div className="text-xs text-slate-500">Fee: {money(txn.fee)}</div>
            </div>
            <p className="text-center font-semibold text-slate-700">
              {txn.type === "cash_out" ? "I-type ang GCash number na gagamitin mong pang-send:" : "I-type ang iyong GCash number:"}
            </p>
            <PhoneDisplay value={number} />
            {error ? <Alert>{error}</Alert> : null}
            {confirming ? (
              <div className="space-y-2 rounded-2xl border-2 border-accent bg-white p-4 text-center">
                <p className="font-bold">Tama ba ang number?</p>
                <p className="text-sm text-slate-600">Hindi na ito mababago pagka-confirm.</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="ghost" onClick={() => setConfirming(false)}>
                    Ayusin
                  </Button>
                  <Button variant="success" loading={busy} onClick={() => void lock()}>
                    Oo, i-Lock
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <NumberPad value={number} onChange={setNumber} />
                <Button className="w-full text-lg" disabled={!PHONE_RE.test(number)} onClick={() => setConfirming(true)}>
                  Confirm
                </Button>
              </>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
