import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useStore } from "../../context/StoreContext";
import { useShift } from "./TinderaLayout";
import { computeShiftSummary, endShift, type EndShiftSummary } from "../../services/shifts";
import { money } from "../../lib/format";
import { PhotoCapture } from "../../components/PhotoCapture";
import { Alert, Button, Card, Field, PageTitle, Spinner } from "../../components/ui";

/**
 * End Shift audit: tindera counts the drawer BLIND (expected amount is hidden until submit)
 * so she can't just type the expected number.
 */
export default function EndShift() {
  const { store } = useStore();
  const shift = useShift();
  const nav = useNavigate();
  const [summary, setSummary] = useState<EndShiftSummary | null>(null);
  const [cash, setCash] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<(EndShiftSummary & { shortage: number }) | null>(null);
  // Firestore fires the "shift closed" snapshot before endShift() resolves; remember we
  // submitted so we wait for the result instead of redirecting to Start Shift.
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!store || !shift) return;
    computeShiftSummary(store.id, shift)
      .then(setSummary)
      .catch((e) => setErr((e as Error).message));
  }, [store, shift]);

  if (result) {
    return (
      <div className="space-y-3">
        <PageTitle>Shift Closed</PageTitle>
        <Card className="space-y-2 text-center">
          <div className="text-sm text-slate-500">Resulta ng Audit</div>
          {result.shortage > 0 ? (
            <div className="text-2xl font-black text-red-600">Kulang {money(result.shortage)}</div>
          ) : result.shortage < 0 ? (
            <div className="text-2xl font-black text-amber-600">Sobra {money(-result.shortage)}</div>
          ) : (
            <div className="text-2xl font-black text-emerald-600">Sakto! ✅</div>
          )}
          <p className="text-sm">Commission ngayong shift: <b>{money(result.commission_total)}</b></p>
          <p className="text-sm text-slate-500">Naipadala kay Boss para sa review.</p>
          <Button className="w-full" onClick={() => nav("/tindera/start", { replace: true })}>
            OK
          </Button>
        </Card>
      </div>
    );
  }

  if (!store) return null;
  if (!shift && submitted) {
    return (
      <div className="flex justify-center p-8 text-brand">
        <Spinner />
      </div>
    );
  }
  if (!shift) return <Navigate to="/tindera/start" replace />;

  const submit = async () => {
    const amt = Number(cash);
    if (cash === "" || !Number.isFinite(amt) || amt < 0) return setErr("Ilagay ang binilang na cash.");
    if (!photo) return setErr("Kailangan ng selfie kasama ang cash drawer.");
    setBusy(true);
    setErr(null);
    setSubmitted(true);
    try {
      setResult(await endShift(store, shift, amt, photo, note.trim()));
    } catch (e) {
      setSubmitted(false);
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <PageTitle>End Shift Audit</PageTitle>
      <Card className="space-y-3">
        {!summary ? (
          <div className="flex justify-center text-brand">
            <Spinner />
          </div>
        ) : summary.unresolved > 0 ? (
          <Alert tone="yellow">May {summary.unresolved} transaction pa na hindi tapos. Hintayin si Boss o i-cancel sa Home.</Alert>
        ) : (
          <p className="text-sm text-slate-600">{summary.txn_count} approved transactions ngayong shift.</p>
        )}
        <Field label="Binilang na Cash sa Drawer (₱)" type="number" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} />
        <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <PhotoCapture value={photo} onChange={setPhoto} label="Selfie + Cash Drawer" />
        {err ? <Alert>{err}</Alert> : null}
        <Button variant="danger" className="w-full text-lg" loading={busy} disabled={!summary || summary.unresolved > 0} onClick={() => void submit()}>
          🔚 End Shift
        </Button>
      </Card>
    </div>
  );
}
