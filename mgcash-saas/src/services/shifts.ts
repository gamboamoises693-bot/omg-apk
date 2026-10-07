import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { balanceDelta } from "../lib/fees";
import { fetchShiftTxns } from "./transactions";
import type { Shift, Store, Tindera } from "../lib/types";

const shiftCol = (storeId: string) => collection(db, "stores", storeId, "shifts");

export function shiftFromDoc(id: string, d: DocumentData): Shift {
  return { id, ...(d as Omit<Shift, "id">) };
}

/** Save a compressed photo (data URL) under the store; returns photo id. */
export async function savePhoto(storeId: string, uid: string, kind: string, dataUrl: string): Promise<string> {
  const ref = await addDoc(collection(db, "stores", storeId, "photos"), {
    kind,
    created_by: uid,
    data_url: dataUrl,
    created_at: serverTimestamp(),
  });
  return ref.id;
}

export async function getPhoto(storeId: string, photoId: string): Promise<string | null> {
  if (!photoId) return null;
  const snap = await getDoc(doc(db, "stores", storeId, "photos", photoId));
  return snap.exists() ? (snap.data().data_url as string) : null;
}

export async function startShift(store: Store, t: Tindera, startCash: number, photoDataUrl: string): Promise<string> {
  const photoId = await savePhoto(store.id, t.id, "shift_start", photoDataUrl);
  const ref = await addDoc(shiftCol(store.id), {
    store_id: store.id,
    tindera_id: t.id,
    tindera_name: t.name,
    status: "open",
    start_at: serverTimestamp(),
    start_photo_id: photoId,
    start_cash: startCash,
  });
  return ref.id;
}

/** Tindera's currently open shift (at most one). */
export function watchOpenShift(storeId: string, tinderaId: string, cb: (s: Shift | null) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(shiftCol(storeId), where("tindera_id", "==", tinderaId), where("status", "==", "open"), limit(1)),
    (snap) => cb(snap.empty ? null : shiftFromDoc(snap.docs[0].id, snap.docs[0].data())),
    (e) => onErr?.(e),
  );
}

export interface EndShiftSummary {
  expected_cash: number;
  txn_count: number;
  commission_total: number;
  unresolved: number;
}

/** Expected drawer cash = start cash + cash effect of every APPROVED txn in this shift. */
export async function computeShiftSummary(storeId: string, shift: Shift): Promise<EndShiftSummary> {
  const txns = await fetchShiftTxns(storeId, shift.tindera_id, shift.id);
  let expected = shift.start_cash;
  let count = 0;
  let commission = 0;
  let unresolved = 0;
  for (const t of txns) {
    if (t.status === "approved") {
      expected += balanceDelta(t.type, t.amount, t.fee).cash;
      commission += t.commission;
      count++;
    } else if (t.status === "pending" || t.status === "awaiting_number") {
      unresolved++;
    }
  }
  return { expected_cash: expected, txn_count: count, commission_total: commission, unresolved };
}

export async function endShift(
  store: Store,
  shift: Shift,
  endCash: number,
  photoDataUrl: string,
  note: string,
): Promise<EndShiftSummary & { shortage: number }> {
  const summary = await computeShiftSummary(store.id, shift);
  if (summary.unresolved > 0) {
    throw new Error(`May ${summary.unresolved} pending pa. Hintayin ang approval ni Boss o i-cancel muna.`);
  }
  const photoId = await savePhoto(store.id, shift.tindera_id, "shift_end", photoDataUrl);
  const shortage = Math.round((summary.expected_cash - endCash) * 100) / 100;
  await updateDoc(doc(shiftCol(store.id), shift.id), {
    status: "closed",
    end_at: serverTimestamp(),
    end_photo_id: photoId,
    end_cash: endCash,
    expected_cash: summary.expected_cash,
    shortage,
    end_note: note,
    txn_count: summary.txn_count,
    commission_total: summary.commission_total,
    audit_status: "pending",
  });
  return { ...summary, shortage };
}

/** Owner: shifts since a date (all tinderas). */
export function watchShiftsSince(storeId: string, since: Date, cb: (s: Shift[]) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(shiftCol(storeId), where("start_at", ">=", Timestamp.fromDate(since)), orderBy("start_at", "desc")),
    (snap) => cb(snap.docs.map((d) => shiftFromDoc(d.id, d.data()))),
    (e) => onErr?.(e),
  );
}

export async function auditShift(
  storeId: string,
  shiftId: string,
  decision: "approved" | "deducted",
  deduction: number,
  note: string,
): Promise<void> {
  await updateDoc(doc(shiftCol(storeId), shiftId), {
    audit_status: decision,
    deduction: decision === "deducted" ? deduction : 0,
    audit_note: note,
    audited_at: serverTimestamp(),
  });
}
