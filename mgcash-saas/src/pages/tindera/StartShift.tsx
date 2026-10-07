import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useStore } from "../../context/StoreContext";
import { startShift } from "../../services/shifts";
import { useShift } from "./TinderaLayout";
import { PhotoCapture } from "../../components/PhotoCapture";
import { Alert, Button, Card, Field, PageTitle } from "../../components/ui";

export default function StartShift() {
  const { store, me } = useStore();
  const shift = useShift();
  const nav = useNavigate();
  const [cash, setCash] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (shift) return <Navigate to="/tindera" replace />;
  if (!store || !me) return null;

  const submit = async () => {
    const amt = Number(cash);
    if (cash === "" || !Number.isFinite(amt) || amt < 0) return setErr("Ilagay ang binilang na cash sa drawer.");
    if (!photo) return setErr("Kailangan ng selfie kasama ang cash drawer.");
    setBusy(true);
    setErr(null);
    try {
      await startShift(store, me, amt, photo);
      nav("/tindera", { replace: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <PageTitle>Start Shift</PageTitle>
      <Card className="space-y-3">
        <p className="text-slate-600">Bilangin ang cash sa drawer at mag-selfie kasama ito bilang proof.</p>
        <Field label="Cash sa Drawer (₱)" type="number" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} />
        <PhotoCapture value={photo} onChange={setPhoto} label="Selfie + Cash Drawer" />
        {err ? <Alert>{err}</Alert> : null}
        <Button className="w-full text-lg" loading={busy} onClick={() => void submit()}>
          ▶️ Start Shift
        </Button>
      </Card>
    </div>
  );
}
