import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useStore } from "../../context/StoreContext";
import { addTindera, updateTindera, watchTinderas } from "../../services/tinderas";
import { watchTxnsSince } from "../../services/transactions";
import { watchShiftsSince } from "../../services/shifts";
import { resetUserPassword } from "../../services/admin";
import { authErrorMessage, USERNAME_RE } from "../../lib/authEmail";
import { fmtDate, money, normalizePhone, startOfManilaDay } from "../../lib/format";
import { toDate } from "../../lib/dates";
import { Alert, Badge, Button, Card, Empty, Field, Modal, PageTitle } from "../../components/ui";
import type { Shift, Tindera, Transaction } from "../../lib/types";

const DEFAULT_PAY = { base_salary: 4500, commission_cash: 2, commission_load: 1, bonus: 500 };

function monthStart(): Date {
  const d = startOfManilaDay();
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(d);
  return new Date(`${ymd.slice(0, 8)}01T00:00:00+08:00`);
}

export default function OwnerTinderas() {
  const { store } = useStore();
  const [list, setList] = useState<Tindera[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [editing, setEditing] = useState<Tindera | "new" | null>(null);
  const [viewing, setViewing] = useState<Tindera | null>(null);

  useEffect(() => {
    if (!store) return;
    const since = monthStart();
    const u = [watchTinderas(store.id, setList), watchTxnsSince(store.id, since, setTxns), watchShiftsSince(store.id, since, setShifts)];
    return () => u.forEach((x) => x());
  }, [store]);

  const perf = useMemo(() => {
    const today = startOfManilaDay().getTime();
    const map = new Map<string, { today: number; month: number; count: number; short: number }>();
    for (const t of txns) {
      if (t.status !== "approved") continue;
      const m = map.get(t.tindera_id) ?? { today: 0, month: 0, count: 0, short: 0 };
      m.month += t.commission;
      m.count++;
      if ((toDate(t.created_at)?.getTime() ?? 0) >= today) m.today += t.commission;
      map.set(t.tindera_id, m);
    }
    for (const s of shifts) {
      if ((s.shortage ?? 0) <= 0) continue;
      const m = map.get(s.tindera_id) ?? { today: 0, month: 0, count: 0, short: 0 };
      m.short += s.shortage ?? 0;
      map.set(s.tindera_id, m);
    }
    return map;
  }, [txns, shifts]);

  if (!store) return null;

  return (
    <div className="space-y-3">
      <PageTitle right={<Button onClick={() => setEditing("new")}>+ Add</Button>}>Tindera</PageTitle>
      <Alert tone="blue">
        Tindera login: Store Code <b>{store.store_code}</b> + username + password.
      </Alert>
      {list.length === 0 ? <Empty>Wala pang tindera. Mag-add para makapag-transact.</Empty> : null}
      {list.map((t) => {
        const p = perf.get(t.id);
        return (
          <Card key={t.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">{t.name}</div>
                <div className="text-xs text-slate-500">
                  @{t.username} · {t.phone}
                </div>
              </div>
              <Badge tone={t.active ? "green" : "slate"}>{t.active ? "Active" : "Disabled"}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg bg-slate-50 p-2">
                <div className="text-xs text-slate-500">Comm. Today</div>
                <b>{money(p?.today)}</b>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <div className="text-xs text-slate-500">Comm. Month</div>
                <b>{money(p?.month)}</b>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <div className="text-xs text-slate-500">Kulang (Month)</div>
                <b className={p?.short ? "text-red-600" : ""}>{money(p?.short)}</b>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Sahod {money(t.base_salary)}/mo · {money(t.commission_cash)}/cash txn · {money(t.commission_load)}/load · Bonus {money(t.bonus)}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setViewing(t)}>
                Shortage History
              </Button>
              <Button variant="ghost" onClick={() => setEditing(t)}>
                Edit
              </Button>
            </div>
          </Card>
        );
      })}

      <TinderaForm open={editing !== null} tindera={editing === "new" ? null : editing} onClose={() => setEditing(null)} />

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Shortage History - ${viewing?.name ?? ""}`}>
        <ul className="divide-y text-sm">
          {shifts
            .filter((s) => s.tindera_id === viewing?.id && s.status === "closed")
            .map((s) => (
              <li key={s.id} className="flex justify-between py-2">
                <span>
                  {fmtDate(toDate(s.start_at))}
                  <span className="block text-xs text-slate-500">{s.audit_status}</span>
                </span>
                <b className={(s.shortage ?? 0) > 0 ? "text-red-600" : "text-emerald-600"}>
                  {(s.shortage ?? 0) > 0 ? `Kulang ${money(s.shortage)}` : (s.shortage ?? 0) < 0 ? `Sobra ${money(-(s.shortage ?? 0))}` : "Sakto"}
                </b>
              </li>
            ))}
        </ul>
      </Modal>
    </div>
  );
}

function TinderaForm({ open, tindera, onClose }: { open: boolean; tindera: Tindera | null; onClose: () => void }) {
  const { store } = useStore();
  const isNew = !tindera;
  const [f, setF] = useState({ name: "", username: "", phone: "", password: "", ...toStr(DEFAULT_PAY), active: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setNewPw("");
    setF(
      tindera
        ? { name: tindera.name, username: tindera.username, phone: tindera.phone, password: "", ...toStr(tindera), active: tindera.active }
        : { name: "", username: "", phone: "", password: "", ...toStr(DEFAULT_PAY), active: true },
    );
  }, [open, tindera]);

  if (!store) return null;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const pay = {
      base_salary: Number(f.base_salary),
      commission_cash: Number(f.commission_cash),
      commission_load: Number(f.commission_load),
      bonus: Number(f.bonus),
    };
    if (Object.values(pay).some((n) => !Number.isFinite(n) || n < 0)) return setErr("Invalid na halaga sa sahod/commission.");
    if (!f.name.trim()) return setErr("Ilagay ang pangalan.");
    setBusy(true);
    setErr(null);
    try {
      if (isNew) {
        const username = f.username.trim().toLowerCase();
        if (!USERNAME_RE.test(username)) throw new Error("Username: 3-20 letters/numbers/underscore lang.");
        if (f.password.length < 6) throw new Error("Password: 6 characters pataas.");
        await addTindera(store, { ...pay, name: f.name, username, phone: normalizePhone(f.phone), password: f.password });
      } else {
        await updateTindera(store.id, tindera.id, { ...pay, name: f.name.trim(), phone: normalizePhone(f.phone), active: f.active });
      }
      onClose();
    } catch (e2) {
      setErr(authErrorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  const resetPw = async () => {
    if (!tindera || newPw.length < 6) return setErr("Bagong password: 6 characters pataas.");
    setBusy(true);
    try {
      await resetUserPassword(tindera.id, newPw);
      setErr(null);
      setNewPw("");
      alert("Na-reset ang password.");
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isNew ? "Add Tindera" : `Edit ${tindera.name}`}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Pangalan" value={f.name} onChange={set("name")} />
        {isNew ? (
          <>
            <Field label="Username (pang-login)" value={f.username} onChange={set("username")} autoCapitalize="none" placeholder="e.g. joy" />
            <Field label="Password" type="password" value={f.password} onChange={set("password")} autoComplete="new-password" />
          </>
        ) : null}
        <Field label="Phone" inputMode="tel" value={f.phone} onChange={set("phone")} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Base Salary /month" type="number" value={f.base_salary} onChange={set("base_salary")} />
          <Field label="Bonus" type="number" value={f.bonus} onChange={set("bonus")} />
          <Field label="Commission /Cash txn" type="number" value={f.commission_cash} onChange={set("commission_cash")} />
          <Field label="Commission /Load" type="number" value={f.commission_load} onChange={set("commission_load")} />
        </div>
        {!isNew ? (
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" className="h-5 w-5" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            Active (naka-off = hindi makaka-login / transact)
          </label>
        ) : null}
        {err ? <Alert>{err}</Alert> : null}
        <Button type="submit" className="w-full" loading={busy}>
          Save
        </Button>
        {!isNew ? (
          <div className="space-y-2 border-t pt-3">
            <Field label="Reset Password" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Bagong password" />
            <Button type="button" variant="ghost" className="w-full" loading={busy} onClick={() => void resetPw()}>
              Reset Password
            </Button>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

function toStr(p: { base_salary: number; commission_cash: number; commission_load: number; bonus: number }) {
  return {
    base_salary: String(p.base_salary),
    commission_cash: String(p.commission_cash),
    commission_load: String(p.commission_load),
    bonus: String(p.bonus),
  };
}
