import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { normalizeName } from "./format";

/* ---------------- Types ---------------- */

export interface Medicine {
  id: string;
  name: string;
  /** Unit word shown after the count, e.g. "tableta". */
  form: string;
  category: string;
  needsPrescription: boolean;
  stock: number;
  /** "Paubos" warning when stock <= minStock. */
  minStock: number;
  /** Earliest expiry in stock, YYYY-MM-DD ("" = unknown). */
  expiry: string;
  lastGivenAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type MedicineLogType = "dispense" | "restock" | "dispose";

export interface MedicineLogItem {
  medicineId: string;
  name: string;
  form: string;
  qty: number;
}

export interface MedicineLog {
  id: string;
  type: MedicineLogType;
  items: MedicineLogItem[];
  medicineIds: string[];
  /** dispense only */
  residentId?: string;
  residentName?: string;
  residentKey?: string;
  purok?: string;
  reason?: string;
  /** restock: source; dispose: why; dispense: optional note */
  note?: string;
  expiry?: string;
  byId: string;
  byName: string;
  createdAt?: Timestamp;
}

/* ---------------- Constants ---------------- */

export const MEDICINE_FORMS = ["tableta", "kapsula", "sachet", "bote (syrup)", "piraso", "vial", "tube"] as const;

export const MEDICINE_CATEGORIES = [
  "Lagnat / Sakit ng katawan",
  "Ubo / Sipon",
  "Antibiotic",
  "Maintenance (BP / Diabetes)",
  "Tiyan / Pagtatae",
  "Vitamins",
  "First aid",
  "Iba pa",
] as const;

export const DISPENSE_REASONS = [
  "Lagnat",
  "Ubo / Sipon",
  "Sakit ng ulo / katawan",
  "Altapresyon (maintenance)",
  "Diabetes (maintenance)",
  "Pagtatae",
  "Sugat / First aid",
  "Vitamins (bata / buntis / senior)",
  "Iba pa",
] as const;

export const RESTOCK_SOURCES = ["RHU Cuyapo / DOH", "Munisipyo", "Donasyon", "Binili ng Barangay", "Iba pa"] as const;
export const DISPOSE_REASONS = ["Expired", "Sira / Nabasa", "Nawala", "Maling bilang (itinama)"] as const;

/** Expiry warning window. */
export const EXPIRY_WARN_DAYS = 60;
/** "Recently received the same medicine" warning window. */
export const REPEAT_WARN_DAYS = 30;

/* ---------------- Helpers ---------------- */

export function daysUntil(dateISO: string, now = new Date()): number | null {
  if (!dateISO) return null;
  const d = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

export type StockStatus = "ubos" | "expired" | "expiring" | "paubos" | "ok";

export function stockStatus(m: Medicine): StockStatus {
  if (m.stock <= 0) return "ubos";
  const d = daysUntil(m.expiry);
  if (d !== null && d < 0) return "expired";
  if (d !== null && d <= EXPIRY_WARN_DAYS) return "expiring";
  if (m.stock <= m.minStock) return "paubos";
  return "ok";
}

export function isLow(m: Medicine): boolean {
  return m.stock > 0 && m.stock <= m.minStock;
}

export function isExpiringSoon(m: Medicine): boolean {
  const d = daysUntil(m.expiry);
  return m.stock > 0 && d !== null && d <= EXPIRY_WARN_DAYS;
}

/** Same person across visits: account uid, or name + purok for walk-ins without an account. */
export function residentKeyOf(residentId: string, name: string, purok: string): string {
  return residentId ? `uid:${residentId}` : `name:${normalizeName(name)}|${normalizeName(purok)}`;
}

/** Keeps the earliest expiry date, ignoring blanks. */
export function earliestDate(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

const medicinesCol = collection(db, "medicines");
const logsCol = collection(db, "medicineLogs");

interface Staff {
  uid: string;
  name: string;
}

/* ---------------- Writes (all in transactions so stock stays exact) ---------------- */

/** Adds a new medicine, logging the starting stock as a restock. */
export async function createMedicine(
  data: Omit<Medicine, "id" | "createdAt" | "updatedAt" | "lastGivenAt">,
  staff: Staff,
  source: string,
): Promise<string> {
  const ref = doc(medicinesCol);
  await runTransaction(db, async (tx) => {
    tx.set(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    if (data.stock > 0) {
      tx.set(doc(logsCol), {
        type: "restock",
        items: [{ medicineId: ref.id, name: data.name, form: data.form, qty: data.stock }],
        medicineIds: [ref.id],
        note: source,
        expiry: data.expiry,
        byId: staff.uid,
        byName: staff.name,
        createdAt: serverTimestamp(),
      });
    }
  });
  return ref.id;
}

export async function restockMedicine(m: Medicine, qty: number, expiry: string, source: string, staff: Staff): Promise<void> {
  if (!Number.isInteger(qty) || qty <= 0) throw new Error("Ilagay ang tamang dami.");
  const ref = doc(db, "medicines", m.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Wala na ang gamot na ito.");
    const cur = snap.data() as Medicine;
    // When the shelf was empty the old expiry no longer applies.
    const nextExpiry = cur.stock > 0 ? earliestDate(cur.expiry ?? "", expiry) : expiry;
    tx.update(ref, { stock: cur.stock + qty, expiry: nextExpiry, updatedAt: serverTimestamp() });
    tx.set(doc(logsCol), {
      type: "restock",
      items: [{ medicineId: m.id, name: cur.name, form: cur.form, qty }],
      medicineIds: [m.id],
      note: source,
      expiry,
      byId: staff.uid,
      byName: staff.name,
      createdAt: serverTimestamp(),
    });
  });
}

export async function disposeMedicine(m: Medicine, qty: number, reason: string, staff: Staff): Promise<void> {
  if (!Number.isInteger(qty) || qty <= 0) throw new Error("Ilagay ang tamang dami.");
  const ref = doc(db, "medicines", m.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Wala na ang gamot na ito.");
    const cur = snap.data() as Medicine;
    if (qty > cur.stock) throw new Error(`${cur.stock} na lang ang natitira.`);
    const left = cur.stock - qty;
    tx.update(ref, { stock: left, expiry: left === 0 ? "" : cur.expiry ?? "", updatedAt: serverTimestamp() });
    tx.set(doc(logsCol), {
      type: "dispose",
      items: [{ medicineId: m.id, name: cur.name, form: cur.form, qty }],
      medicineIds: [m.id],
      note: reason,
      byId: staff.uid,
      byName: staff.name,
      createdAt: serverTimestamp(),
    });
  });
}

export interface DispenseInput {
  residentId: string;
  residentName: string;
  purok: string;
  reason: string;
  note: string;
  items: { medicineId: string; qty: number }[];
}

/**
 * Gives medicine to a resident: one log entry, every stock reduced in the same
 * transaction. Fails as a whole if any medicine does not have enough left.
 */
export async function dispenseMedicines(input: DispenseInput, staff: Staff): Promise<void> {
  const items = input.items.filter((i) => i.qty > 0);
  if (!input.residentName.trim()) throw new Error("Ilagay ang pangalan ng residente.");
  if (!input.purok) throw new Error("Piliin ang purok.");
  if (items.length === 0) throw new Error("Pumili ng kahit isang gamot.");
  if (new Set(items.map((i) => i.medicineId)).size !== items.length) throw new Error("Dalawang beses napili ang isang gamot.");

  await runTransaction(db, async (tx) => {
    const refs = items.map((i) => doc(db, "medicines", i.medicineId));
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));
    const logItems: MedicineLogItem[] = [];

    snaps.forEach((snap, idx) => {
      if (!snap.exists()) throw new Error("May gamot na wala na sa listahan. I-refresh.");
      const cur = snap.data() as Medicine;
      const qty = items[idx].qty;
      if (!Number.isInteger(qty) || qty <= 0) throw new Error(`Maling dami para sa ${cur.name}.`);
      if (qty > cur.stock) throw new Error(`Kulang ang ${cur.name}: ${cur.stock} na lang ang natitira.`);
      logItems.push({ medicineId: snap.id, name: cur.name, form: cur.form, qty });
      const left = cur.stock - qty;
      tx.update(refs[idx], {
        stock: left,
        expiry: left === 0 ? "" : cur.expiry ?? "",
        lastGivenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    tx.set(doc(logsCol), {
      type: "dispense",
      items: logItems,
      medicineIds: logItems.map((i) => i.medicineId),
      residentId: input.residentId,
      residentName: input.residentName.trim(),
      residentKey: residentKeyOf(input.residentId, input.residentName, input.purok),
      purok: input.purok,
      reason: input.reason,
      note: input.note.trim().slice(0, 300),
      byId: staff.uid,
      byName: staff.name,
      createdAt: serverTimestamp(),
    });
  });
}

/* ---------------- Public list (no exact counts) ---------------- */

export interface PublicMedicine {
  name: string;
  category: string;
  available: boolean;
  needsPrescription: boolean;
}

export function toPublicList(meds: Medicine[]): PublicMedicine[] {
  return meds
    .map((m) => ({
      name: m.name,
      category: m.category,
      // Expired stock is not really available.
      available: m.stock > 0 && stockStatus(m) !== "expired",
      needsPrescription: !!m.needsPrescription,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Writes botikaPublic/main so residents can see what is available. */
export async function publishPublicList(list: PublicMedicine[]): Promise<void> {
  await setDoc(doc(db, "botikaPublic", "main"), { items: list, updatedAt: serverTimestamp() });
}

/** "30 tableta", "1 bote (syrup)". */
export function qtyLabel(qty: number, form: string): string {
  return `${qty.toLocaleString("en-PH")} ${form}`;
}
