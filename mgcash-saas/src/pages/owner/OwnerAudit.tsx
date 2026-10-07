import { useEffect, useState } from "react";
import { useStore } from "../../context/StoreContext";
import { auditShift, watchShiftsSince } from "../../services/shifts";
import { addDays } from "../../lib/subscription";
import { fmtDateTime, money } from "../../lib/format";
import { toDate } from "../../lib/dates";
import { Alert, Badge, Button, Card, Empty, PageTitle } from "../../components/ui";
import { PhotoViewer } from "../../components/PhotoViewer";
import type { Shift } from "../../lib/types";

/** Review closed shifts: compare expected vs counted cash, approve or deduct shortage. */
export default function OwnerAudit() {
  const { store } = useStore();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [tab, setTab] = useState<"pending" | "done">("pending");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => (store ? watchShiftsSince(store.id, addDays(new Date(), -31), setShifts, (e) => setErr(e.message)) : undefined), [store]);

  if (!store) return null;
  const closed = shifts.filter((s) => s.status === "closed");
  const list = closed.filter((s) => (tab === "pending" ? s.audit_status === "pending" : s.audit_status !== "pending"));
  const open = shifts.filter((s) => s.status === "open");

  return (
    <div className="space-y-3">
      <PageTitle>Audit Review</PageTitle>
      {err ? <Alert>{err}</Alert> : null}
      {open.map((s) => (
        <Alert key={s.id} tone="blue">
          🟢 {s.tindera_name} naka-shift mula {fmtDateTime(toDate(s.start_at))} · Start cash {money(s.start_cash)}
        </Alert>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <Button variant={tab === "pending" ? "primary" : "ghost"} onClick={() => setTab("pending")}>
          Pending ({closed.filter((s) => s.audit_status === "pending").length})
        </Button>
        <Button variant={tab === "done" ? "primary" : "ghost"} onClick={() => setTab("done")}>
          Tapos na
        </Button>
      </div>
      {list.length === 0 ? <Empty>Walang shift dito.</Empty> : null}
      {list.map((s) => (
        <AuditCard key={s.id} storeId={store.id} shift={s} />
      ))}
    </div>
  );
}

function AuditCard({ storeId, shift: s }: { storeId: string; shift: Shift }) {
  const shortage = s.shortage ?? 0;
  const [deduct, setDeduct] = useState(String(Math.max(0, shortage)));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const decide = async (decision: "approved" | "deducted") => {
    const amt = Number(deduct);
    if (decision === "deducted" && (!Number.isFinite(amt) || amt <= 0)) return setErr("Ilagay ang halaga ng deduction.");
    setBusy(true);
    setErr(null);
    try {
      await auditShift(storeId, s.id, decision, amt, note.trim());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold">{s.tindera_name}</div>
          <div className="text-xs text-slate-500">
            {fmtDateTime(toDate(s.start_at))} → {fmtDateTime(toDate(s.end_at ?? null))}
          </div>
        </div>
        {shortage > 0 ? (
          <Badge tone="red">Kulang {money(shortage)}</Badge>
        ) : shortage < 0 ? (
          <Badge tone="yellow">Sobra {money(-shortage)}</Badge>
        ) : (
          <Badge tone="green">Sakto</Badge>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg bg-slate-50 p-2">
          <div className="text-xs text-slate-500">Start Cash</div>
          <b>{money(s.start_cash)}</b>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <div className="text-xs text-slate-500">Expected</div>
          <b>{money(s.expected_cash)}</b>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <div className="text-xs text-slate-500">Binilang</div>
          <b>{money(s.end_cash)}</b>
        </div>
      </div>
      <div className="text-xs text-slate-500">
        {s.txn_count ?? 0} approved txns · Commission {money(s.commission_total)}
        {s.end_note ? <div>Note: “{s.end_note}”</div> : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PhotoViewer storeId={storeId} photoId={s.start_photo_id} alt="Start photo" />
        <PhotoViewer storeId={storeId} photoId={s.end_photo_id} alt="End photo" />
      </div>
      {s.audit_status === "pending" ? (
        <div className="space-y-2 border-t pt-2">
          <div className="grid grid-cols-2 gap-2">
            <input className="input" type="number" inputMode="decimal" value={deduct} onChange={(e) => setDeduct(e.target.value)} placeholder="Deduction ₱" />
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" />
          </div>
          {err ? <Alert>{err}</Alert> : null}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="success" loading={busy} onClick={() => void decide("approved")}>
              Approve (OK)
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void decide("deducted")}>
              Deduct sa Sahod
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-sm">
          <Badge tone={s.audit_status === "deducted" ? "red" : "green"}>{s.audit_status}</Badge>
          {s.deduction ? <span className="ml-2 font-semibold text-red-600">-{money(s.deduction)}</span> : null}
          {s.audit_note ? <span className="ml-2 text-slate-500">{s.audit_note}</span> : null}
        </div>
      )}
    </Card>
  );
}
