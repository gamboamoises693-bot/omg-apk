"use client";

import { useMemo, useState } from "react";
import { collection, deleteDoc, doc, limit, orderBy, query, where } from "firebase/firestore";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { logActivity } from "@/lib/activity";
import { formatDate, friendlyError, timeAgo } from "@/lib/format";
import {
  DISPOSE_REASONS,
  RESTOCK_SOURCES,
  daysUntil,
  disposeMedicine,
  qtyLabel,
  restockMedicine,
  type Medicine,
  type MedicineLog,
} from "@/lib/botika";
import { Badge, Button, Input, Select, Spinner, SelectOther } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { MedicineForm } from "./MedicineForm";

type Panel = "none" | "restock" | "dispose" | "edit";

/** One medicine: numbers, add stock, throw away, edit details and its movement history. */
export function MedicineDetail({ m, onDeleted }: { m: Medicine; onDeleted: () => void }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [panel, setPanel] = useState<Panel>("none");
  const [qty, setQty] = useState("");
  const [expiry, setExpiry] = useState("");
  const [source, setSource] = useState<string>(RESTOCK_SOURCES[0]);
  const [reason, setReason] = useState<string>(DISPOSE_REASONS[0]);
  const [busy, setBusy] = useState(false);

  const logsQ = useMemo(() => query(collection(db, "medicineLogs"), where("medicineIds", "array-contains", m.id), orderBy("createdAt", "desc"), limit(25)), [m.id]);
  const logs = useCollection<MedicineLog>(logsQ);

  const staff = user && profile ? { uid: user.uid, name: profile.fullName } : null;
  const d = daysUntil(m.expiry);

  const run = async (fn: () => Promise<void>, ok: string, log: string) => {
    setBusy(true);
    try {
      await fn();
      logActivity("Botika", log, m.id);
      toast(ok);
      setPanel("none");
      setQty("");
      setExpiry("");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const n = Math.floor(Number(qty));

  const restock = () => {
    if (!staff) return;
    if (!expiry) return toast("Ilagay ang expiry date ng bagong stock.", "error");
    run(() => restockMedicine(m, n, expiry, source, staff), "Naidagdag sa stock.", `Nagdagdag ng ${qtyLabel(n, m.form)} na ${m.name} (${source})`);
  };

  const dispose = () => {
    if (!staff) return;
    if (!confirm(`Itapon ang ${qtyLabel(n, m.form)} na ${m.name}? (${reason})`)) return;
    run(() => disposeMedicine(m, n, reason, staff), "Nabawas sa stock.", `Nagtapon ng ${qtyLabel(n, m.form)} na ${m.name}: ${reason}`);
  };

  const remove = async () => {
    if (m.stock > 0) return toast("May stock pa. Itapon muna ang natitira bago burahin.", "error");
    if (!confirm(`Burahin ang ${m.name} sa listahan? Mananatili ang history nito.`)) return;
    try {
      await deleteDoc(doc(db, "medicines", m.id));
      logActivity("Botika", `Binura ang ${m.name} sa listahan`, m.id);
      toast("Nabura ang gamot.");
      onDeleted();
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  if (panel === "edit") {
    return (
      <div>
        <button onClick={() => setPanel("none")} className="mb-3 text-sm font-semibold text-brand">← Bumalik</button>
        <MedicineForm existing={m} onDone={() => setPanel("none")} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <Badge color="gray">{m.category}</Badge>
        {m.needsPrescription && <Badge color="gold">Kailangan ng reseta</Badge>}
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-gray-50 p-3 text-center">
        <div>
          <p className={`text-xl font-extrabold ${m.stock <= m.minStock ? "text-yellow-700" : "text-brand"}`}>{m.stock.toLocaleString("en-PH")}</p>
          <p className="text-[0.7rem] text-gray-500">Natitira ({m.form})</p>
        </div>
        <div>
          <p className="text-xl font-extrabold">{m.minStock}</p>
          <p className="text-[0.7rem] text-gray-500">Minimum</p>
        </div>
        <div>
          <p className={`text-sm font-extrabold ${d !== null && d <= 60 ? "text-red-700" : ""}`}>{m.expiry ? formatDate(m.expiry) : "—"}</p>
          <p className="text-[0.7rem] text-gray-500">Expiry</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button variant={panel === "restock" ? "primary" : "soft"} onClick={() => setPanel(panel === "restock" ? "none" : "restock")}>
          <Plus className="h-4 w-4" /> Stock
        </Button>
        <Button variant={panel === "dispose" ? "danger" : "outline"} onClick={() => setPanel(panel === "dispose" ? "none" : "dispose")}>
          <Minus className="h-4 w-4" /> Itapon
        </Button>
        <Button variant="outline" onClick={() => setPanel("edit")}>
          <Pencil className="h-4 w-4" /> Ayusin
        </Button>
      </div>

      {panel === "restock" && (
        <div className="space-y-3 rounded-xl bg-brand-light/60 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-brand">Dagdag stock (bagong dating)</p>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Dami" type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
            <Input label="Expiry" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
          <SelectOther label="Galing saan" options={RESTOCK_SOURCES} value={source} onChange={setSource} />
          <Button full loading={busy} disabled={!(n > 0)} onClick={restock}>Idagdag sa stock</Button>
        </div>
      )}

      {panel === "dispose" && (
        <div className="space-y-3 rounded-xl bg-red-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-red-700">Itapon / bawasan</p>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Dami" type="number" inputMode="numeric" min={1} max={m.stock} value={qty} onChange={(e) => setQty(e.target.value)} />
            <Select label="Dahilan" options={DISPOSE_REASONS} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button variant="danger" full loading={busy} disabled={!(n > 0)} onClick={dispose}>Ibawas sa stock</Button>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">Galaw ng stock</p>
        {logs.loading ? (
          <Spinner />
        ) : logs.error ? (
          <p className="text-sm text-red-700">{logs.error}</p>
        ) : logs.data.length === 0 ? (
          <p className="text-sm text-gray-500">Wala pang galaw.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {logs.data.map((l) => {
              const item = l.items.find((i) => i.medicineId === m.id);
              const plus = l.type === "restock";
              const label =
                l.type === "dispense" ? `Naibigay kay ${l.residentName} (${l.purok})` : l.type === "restock" ? `Dumating: ${l.note || "stock"}` : `Itinapon: ${l.note || ""}`;
              return (
                <li key={l.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{label}</p>
                    <p className="text-xs text-gray-500">{timeAgo(l.createdAt)} · {l.byName}</p>
                  </div>
                  <span className={`shrink-0 font-extrabold tabular-nums ${plus ? "text-brand" : "text-red-700"}`}>
                    {plus ? "+" : "−"}
                    {item?.qty ?? 0}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button onClick={remove} className="flex w-full items-center justify-center gap-1.5 py-2 text-sm font-semibold text-red-700">
        <Trash2 className="h-4 w-4" /> Burahin ang gamot sa listahan
      </button>
    </div>
  );
}
