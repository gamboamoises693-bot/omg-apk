import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Timestamp,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { balanceDelta, computeFee, storeProfit } from "../lib/fees";
import { manilaDay } from "../lib/format";
import { storeFromDoc, todayStats } from "./stores";
import type { NumberSource, Store, Tindera, Transaction, TxnType } from "../lib/types";

const txnCol = (storeId: string) => collection(db, "stores", storeId, "transactions");

export function txnFromDoc(id: string, d: DocumentData): Transaction {
  return {
    id,
    store_id: d.store_id,
    store_name: d.store_name ?? "",
    tindera_id: d.tindera_id,
    tindera_name: d.tindera_name ?? "",
    shift_id: d.shift_id ?? "",
    type: d.type,
    amount: Number(d.amount ?? 0),
    fee: Number(d.fee ?? 0),
    commission: Number(d.commission ?? 0),
    customer_number: d.customer_number ?? "",
    number_source: d.number_source,
    number_status: d.number_status,
    number_locked_at: d.number_locked_at ?? null,
    status: d.status,
    created_at: d.created_at,
    decided_at: d.decided_at ?? null,
    decided_by: d.decided_by,
    reject_reason: d.reject_reason,
  };
}

export interface NewTxnInput {
  store: Store;
  tindera: Tindera;
  shiftId: string;
  type: TxnType;
  amount: number;
  source: NumberSource;
  /** Required for keypad mode (already locked). Empty for QR mode. */
  customerNumber?: string;
}

/** Tindera creates a transaction. QR mode waits for the customer; keypad mode goes straight to Boss. */
export async function createTxn(i: NewTxnInput): Promise<string> {
  const ref = doc(txnCol(i.store.id));
  const isKeypad = i.source === "keypad";
  await setDoc(ref, {
    store_id: i.store.id,
    store_name: i.store.store_name,
    tindera_id: i.tindera.id,
    tindera_name: i.tindera.name,
    shift_id: i.shiftId,
    type: i.type,
    amount: i.amount,
    fee: computeFee(i.type, i.amount, i.store),
    commission: i.type === "load" ? i.tindera.commission_load : i.tindera.commission_cash,
    customer_number: isKeypad ? i.customerNumber ?? "" : "",
    number_source: i.source,
    number_status: isKeypad ? "locked" : "waiting",
    number_locked_at: isKeypad ? serverTimestamp() : null,
    status: isKeypad ? "pending" : "awaiting_number",
    created_at: serverTimestamp(),
  });
  return ref.id;
}

/** Public customer page: lock the GCash number. Allowed once by security rules. */
export async function lockCustomerNumber(storeId: string, txnId: string, number: string): Promise<void> {
  await updateDoc(doc(db, "stores", storeId, "transactions", txnId), {
    customer_number: number,
    number_status: "locked",
    number_locked_at: serverTimestamp(),
    status: "pending",
  });
}

export async function getTxnPublic(storeId: string, txnId: string): Promise<Transaction | null> {
  const snap = await getDoc(doc(db, "stores", storeId, "transactions", txnId));
  return snap.exists() ? txnFromDoc(snap.id, snap.data()) : null;
}

export function watchTxn(storeId: string, txnId: string, cb: (t: Transaction | null) => void): Unsubscribe {
  return onSnapshot(doc(db, "stores", storeId, "transactions", txnId), (s) =>
    cb(s.exists() ? txnFromDoc(s.id, s.data()) : null),
  );
}

export async function cancelTxn(storeId: string, txnId: string): Promise<void> {
  await updateDoc(doc(db, "stores", storeId, "transactions", txnId), {
    status: "cancelled",
    decided_at: serverTimestamp(),
  });
}

/**
 * Boss approves: atomically flips status and applies balance + daily stats to the store doc.
 * Runs in a Firestore transaction so two quick taps can't double-count.
 */
export async function approveTxn(storeId: string, txnId: string, ownerUid: string): Promise<Transaction> {
  return runTransaction(db, async (tx) => {
    const tRef = doc(db, "stores", storeId, "transactions", txnId);
    const sRef = doc(db, "stores", storeId);
    const [tSnap, sSnap] = await Promise.all([tx.get(tRef), tx.get(sRef)]);
    if (!tSnap.exists() || !sSnap.exists()) throw new Error("Transaction not found.");
    const t = txnFromDoc(tSnap.id, tSnap.data());
    if (t.status !== "pending") throw new Error("Na-process na ang transaction na ito.");

    const store = storeFromDoc(sSnap.id, sSnap.data());
    const delta = balanceDelta(t.type, t.amount, t.fee);
    const stats = todayStats(store);
    tx.update(sRef, {
      gcash_fund: store.gcash_fund + delta.gcash,
      cash_float: store.cash_float + delta.cash,
      stats: {
        day: manilaDay(),
        profit_today: stats.profit_today + storeProfit(t.fee, t.commission),
        commission_today: stats.commission_today + t.commission,
        txn_today: stats.txn_today + 1,
      },
    });
    tx.update(tRef, { status: "approved", decided_at: serverTimestamp(), decided_by: ownerUid });
    return { ...t, status: "approved" };
  });
}

export async function rejectTxn(storeId: string, txnId: string, ownerUid: string, reason: string): Promise<void> {
  await updateDoc(doc(db, "stores", storeId, "transactions", txnId), {
    status: "rejected",
    decided_at: serverTimestamp(),
    decided_by: ownerUid,
    reject_reason: reason,
  });
}

function mapSnap(cb: (t: Transaction[]) => void) {
  return (snap: { docs: { id: string; data: () => DocumentData }[] }) =>
    cb(snap.docs.map((d) => txnFromDoc(d.id, d.data())));
}

/** Owner: pending approvals queue. */
export function watchPending(storeId: string, cb: (t: Transaction[]) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(txnCol(storeId), where("status", "==", "pending"), orderBy("created_at", "desc")),
    mapSnap(cb),
    (e) => onErr?.(e),
  );
}

/** Owner / Super Admin: all txns since a date. */
export function watchTxnsSince(storeId: string, since: Date, cb: (t: Transaction[]) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(txnCol(storeId), where("created_at", ">=", Timestamp.fromDate(since)), orderBy("created_at", "desc")),
    mapSnap(cb),
    (e) => onErr?.(e),
  );
}

/** Tindera: only her own txns (rules require the tindera_id filter). */
export function watchMyTxnsSince(
  storeId: string,
  tinderaId: string,
  since: Date,
  cb: (t: Transaction[]) => void,
  onErr?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      txnCol(storeId),
      where("tindera_id", "==", tinderaId),
      where("created_at", ">=", Timestamp.fromDate(since)),
      orderBy("created_at", "desc"),
    ),
    mapSnap(cb),
    (e) => onErr?.(e),
  );
}

export async function fetchTxns(storeId: string, ...constraints: QueryConstraint[]): Promise<Transaction[]> {
  const snap = await getDocs(query(txnCol(storeId), ...constraints));
  return snap.docs.map((d) => txnFromDoc(d.id, d.data()));
}

/** Approved txns in [from, to) - used by reports and payroll. */
export async function fetchApprovedBetween(storeId: string, from: Date, to: Date): Promise<Transaction[]> {
  return fetchTxns(
    storeId,
    where("status", "==", "approved"),
    where("created_at", ">=", Timestamp.fromDate(from)),
    where("created_at", "<", Timestamp.fromDate(to)),
    orderBy("created_at", "desc"),
  );
}

/** Tindera's own txns for one shift (equality filters only -> no composite index). */
export async function fetchShiftTxns(storeId: string, tinderaId: string, shiftId: string): Promise<Transaction[]> {
  return fetchTxns(storeId, where("tindera_id", "==", tinderaId), where("shift_id", "==", shiftId));
}
