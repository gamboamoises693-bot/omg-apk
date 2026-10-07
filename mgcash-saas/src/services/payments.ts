import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { ts, toDate } from "../lib/dates";
import { addDays, daysForAmount, extendSubscription, PERIOD_DAYS } from "../lib/subscription";
import { storeFromDoc } from "./stores";
import type { Payment, Store } from "../lib/types";

export function paymentFromDoc(id: string, d: DocumentData): Payment {
  return {
    id,
    store_id: d.store_id,
    store_name: d.store_name ?? "",
    amount: Number(d.amount ?? 0),
    gcash_ref: d.gcash_ref ?? "",
    status: d.status,
    has_proof: !!d.has_proof,
    source: d.source ?? "owner_upload",
    note: d.note ?? "",
    created_at: d.created_at,
    paid_at: d.paid_at ?? null,
    period_end: d.period_end ?? null,
  };
}

/** Store owner uploads GCash screenshot -> pending until Super Admin approves. */
export async function submitPaymentProof(store: Store, amount: number, gcashRef: string, proofDataUrl: string): Promise<string> {
  const ref = await addDoc(collection(db, "payments"), {
    store_id: store.id,
    store_name: store.store_name,
    amount,
    gcash_ref: gcashRef.trim(),
    status: "pending",
    has_proof: true,
    source: "owner_upload",
    created_at: serverTimestamp(),
  });
  await setDoc(doc(db, "payment_proofs", ref.id), {
    store_id: store.id,
    data_url: proofDataUrl,
    created_at: serverTimestamp(),
  });
  return ref.id;
}

export async function getPaymentProof(paymentId: string): Promise<string | null> {
  const snap = await getDoc(doc(db, "payment_proofs", paymentId));
  return snap.exists() ? (snap.data().data_url as string) : null;
}

export function watchStorePayments(storeId: string, cb: (p: Payment[]) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, "payments"), where("store_id", "==", storeId), orderBy("created_at", "desc")),
    (snap) => cb(snap.docs.map((d) => paymentFromDoc(d.id, d.data()))),
    (e) => onErr?.(e),
  );
}

export function watchAllPayments(cb: (p: Payment[]) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, "payments"), orderBy("created_at", "desc")),
    (snap) => cb(snap.docs.map((d) => paymentFromDoc(d.id, d.data()))),
    (e) => onErr?.(e),
  );
}

/**
 * Super Admin approves a pending payment: extends subscription atomically.
 * First paid payment of a referred store gives the referrer +30 days free.
 */
export async function approvePayment(paymentId: string, prices = { monthly: 210, daily: 7 }): Promise<void> {
  await runTransaction(db, async (tx) => {
    const pRef = doc(db, "payments", paymentId);
    const pSnap = await tx.get(pRef);
    if (!pSnap.exists()) throw new Error("Payment not found.");
    const p = paymentFromDoc(pSnap.id, pSnap.data());
    if (p.status !== "pending") throw new Error("Na-process na ang payment na ito.");

    const sRef = doc(db, "stores", p.store_id);
    const sSnap = await tx.get(sRef);
    if (!sSnap.exists()) throw new Error("Store not found.");
    const store = storeFromDoc(sSnap.id, sSnap.data());

    // Reads must all happen before writes in a Firestore transaction.
    const rewardReferrer = !!store.referred_by && !store.referral_rewarded;
    const refRef = rewardReferrer ? doc(db, "stores", store.referred_by!) : null;
    const refSnap = refRef ? await tx.get(refRef) : null;

    const newEnd = extendSubscription(toDate(store.subscription_end), daysForAmount(p.amount, prices.monthly, prices.daily));
    tx.update(sRef, {
      subscription_status: "active",
      subscription_start: store.subscription_start ?? serverTimestamp(),
      subscription_end: ts(newEnd),
      deactivated: false,
      ...(rewardReferrer ? { referral_rewarded: true } : {}),
    });
    tx.update(pRef, { status: "paid", paid_at: serverTimestamp(), period_end: ts(newEnd) });

    if (refRef && refSnap?.exists()) {
      const referrer = storeFromDoc(refSnap.id, refSnap.data());
      const base = toDate(referrer.subscription_end) ?? toDate(referrer.trial_end);
      tx.update(refRef, {
        subscription_status: "active",
        subscription_end: ts(extendSubscription(base, PERIOD_DAYS)),
      });
    }
  });
}

export async function rejectPayment(paymentId: string, note: string): Promise<void> {
  await updateDoc(doc(db, "payments", paymentId), { status: "rejected", note, paid_at: null });
}

/** Super Admin records a payment received outside the app (optional screenshot). */
export async function markPaidManual(
  store: Store,
  amount: number,
  gcashRef: string,
  proofDataUrl?: string,
  prices = { monthly: 210, daily: 7 },
): Promise<void> {
  const ref = await addDoc(collection(db, "payments"), {
    store_id: store.id,
    store_name: store.store_name,
    amount,
    gcash_ref: gcashRef.trim(),
    status: "pending",
    has_proof: !!proofDataUrl,
    source: "admin_manual",
    created_at: serverTimestamp(),
  });
  if (proofDataUrl) {
    await setDoc(doc(db, "payment_proofs", ref.id), {
      store_id: store.id,
      data_url: proofDataUrl,
      created_at: serverTimestamp(),
    });
  }
  // Reuse the same atomic path (extension + referral reward).
  await approvePayment(ref.id, prices);
}

export async function extendTrial(store: Store, days = 7): Promise<void> {
  const current = toDate(store.trial_end) ?? new Date();
  const base = current.getTime() > Date.now() ? current : new Date();
  await updateDoc(doc(db, "stores", store.id), { trial_end: ts(addDays(base, days)), deactivated: false });
}

export async function setDeactivated(storeId: string, deactivated: boolean): Promise<void> {
  await updateDoc(doc(db, "stores", storeId), { deactivated });
}

/** Copy-paste / SMS reminder text for an owner. */
export function reminderMessage(store: Store, adminGcash: string, price: number, due: Date): string {
  return (
    `Hi ${store.owner_name}! Paalala mula sa MG-CASH: ang subscription ng "${store.store_name}" ` +
    `ay due sa ${due.toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}. ` +
    `Magpadala ng P${price} sa GCash ${adminGcash} (Moises Gamboa), reference: ${store.store_name}. ` +
    `I-upload ang screenshot sa app. Salamat po!`
  );
}

export async function saveAppConfig(cfg: { admin_name: string; admin_gcash: string; monthly_price: number; daily_price: number }) {
  await setDoc(doc(db, "config", "app"), cfg, { merge: true });
}
