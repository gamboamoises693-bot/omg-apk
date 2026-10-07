import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { createUserSilently, db } from "../lib/firebase";
import { tinderaEmail } from "../lib/authEmail";
import type { Store, Tindera } from "../lib/types";

export function tinderaFromDoc(id: string, d: DocumentData): Tindera {
  return {
    id,
    store_id: d.store_id,
    name: d.name ?? "",
    username: d.username ?? "",
    phone: d.phone ?? "",
    base_salary: Number(d.base_salary ?? 0),
    commission_cash: Number(d.commission_cash ?? 0),
    commission_load: Number(d.commission_load ?? 0),
    bonus: Number(d.bonus ?? 0),
    active: d.active !== false,
    created_at: d.created_at,
  };
}

export type TinderaPay = Pick<Tindera, "base_salary" | "commission_cash" | "commission_load" | "bonus">;

export interface NewTinderaInput extends TinderaPay {
  name: string;
  username: string;
  phone: string;
  password: string;
}

/** Owner creates a tindera login tied to her store (secondary auth app keeps owner signed in). */
export async function addTindera(store: Store, i: NewTinderaInput): Promise<string> {
  return createUserSilently(tinderaEmail(store.store_code, i.username), i.password, async (uid) => {
  const batch = writeBatch(db);
  batch.set(doc(db, "stores", store.id, "tinderas", uid), {
    store_id: store.id,
    name: i.name.trim(),
    username: i.username.trim().toLowerCase(),
    phone: i.phone,
    base_salary: i.base_salary,
    commission_cash: i.commission_cash,
    commission_load: i.commission_load,
    bonus: i.bonus,
    active: true,
    created_at: serverTimestamp(),
  });
  batch.set(doc(db, "users", uid), {
    role: "tindera",
    store_id: store.id,
    name: i.name.trim(),
    username: i.username.trim().toLowerCase(),
    created_at: serverTimestamp(),
  });
  await batch.commit();
  });
}

export async function updateTindera(storeId: string, id: string, patch: Partial<TinderaPay & { name: string; phone: string; active: boolean }>) {
  await updateDoc(doc(db, "stores", storeId, "tinderas", id), patch);
}

export function watchTinderas(storeId: string, cb: (t: Tindera[]) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, "stores", storeId, "tinderas"), orderBy("created_at", "asc")),
    (snap) => cb(snap.docs.map((d) => tinderaFromDoc(d.id, d.data()))),
    (e) => onErr?.(e),
  );
}

export function watchTindera(storeId: string, id: string, cb: (t: Tindera | null) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    doc(db, "stores", storeId, "tinderas", id),
    (s) => cb(s.exists() ? tinderaFromDoc(s.id, s.data()) : null),
    (e) => onErr?.(e),
  );
}
