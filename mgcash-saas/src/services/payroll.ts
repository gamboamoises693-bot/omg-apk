import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  doc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { computePayroll, type PayrollResult } from "../lib/payroll";
import { fetchApprovedBetween } from "./transactions";
import { shiftFromDoc } from "./shifts";
import type { Payroll, Tindera } from "../lib/types";

export interface PayrollPeriod {
  from: Date;
  to: Date; // exclusive
  cutoff: "monthly" | "semi";
  label: string;
}

/** Manila payroll periods: 1-15 and 16-end (semi) or whole month. */
export function periodFor(date: Date, cutoff: "monthly" | "semi"): PayrollPeriod {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(date);
  const [y, m, d] = ymd.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const at = (yy: number, mm: number, dd: number) => new Date(`${yy}-${pad(mm)}-${pad(dd)}T00:00:00+08:00`);
  const nextMonth = m === 12 ? at(y + 1, 1, 1) : at(y, m + 1, 1);
  const monthName = date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", year: "numeric" });
  if (cutoff === "monthly") return { from: at(y, m, 1), to: nextMonth, cutoff, label: monthName };
  return d <= 15
    ? { from: at(y, m, 1), to: at(y, m, 16), cutoff, label: `1-15 ${monthName}` }
    : { from: at(y, m, 16), to: nextMonth, cutoff, label: `16-end ${monthName}` };
}

export interface PayrollRow extends PayrollResult {
  tindera: Tindera;
  txn_count: number;
  shortage_count: number;
}

/** Auto compute payroll for every tindera of the store for a period. */
export async function computeStorePayroll(storeId: string, tinderas: Tindera[], period: PayrollPeriod): Promise<PayrollRow[]> {
  const [txns, shiftSnap] = await Promise.all([
    fetchApprovedBetween(storeId, period.from, period.to),
    getDocs(
      query(
        collection(db, "stores", storeId, "shifts"),
        where("start_at", ">=", Timestamp.fromDate(period.from)),
        where("start_at", "<", Timestamp.fromDate(period.to)),
      ),
    ),
  ]);
  const shifts = shiftSnap.docs.map((d) => shiftFromDoc(d.id, d.data()));

  return tinderas.map((t) => {
    const mine = txns.filter((x) => x.tindera_id === t.id);
    const deductions = shifts
      .filter((s) => s.tindera_id === t.id && s.audit_status === "deducted")
      .map((s) => Number(s.deduction ?? 0));
    const res = computePayroll({
      base_salary: t.base_salary,
      bonus: t.bonus,
      commissions: mine.map((x) => x.commission),
      deductions,
      cutoff: period.cutoff,
    });
    return { ...res, tindera: t, txn_count: mine.length, shortage_count: deductions.length };
  });
}

export async function savePayroll(storeId: string, row: PayrollRow, period: PayrollPeriod): Promise<void> {
  await addDoc(collection(db, "stores", storeId, "payrolls"), {
    store_id: storeId,
    tindera_id: row.tindera.id,
    tindera_name: row.tindera.name,
    period_start: Timestamp.fromDate(period.from),
    period_end: Timestamp.fromDate(period.to),
    period_label: period.label,
    base: row.base,
    commission: row.commission,
    bonus: row.bonus,
    deductions: row.deductions,
    net: row.net,
    paid: true,
    created_at: serverTimestamp(),
  });
}

export function watchPayrolls(storeId: string, cb: (p: (Payroll & { period_label?: string })[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, "stores", storeId, "payrolls"), orderBy("created_at", "desc")), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Payroll, "id">) }))),
  );
}

export async function markPayrollPaid(storeId: string, id: string, paid: boolean) {
  await updateDoc(doc(db, "stores", storeId, "payrolls", id), { paid });
}
