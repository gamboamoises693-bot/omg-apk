import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
  collection,
  query,
  orderBy,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { ownerEmail, makeStoreCode } from "../lib/authEmail";
import { addDays, TRIAL_DAYS } from "../lib/subscription";
import { DEFAULT_FEES } from "../lib/fees";
import { manilaDay } from "../lib/format";
import { ts } from "../lib/dates";
import type { AppConfig, Store } from "../lib/types";

export function storeFromDoc(id: string, d: DocumentData): Store {
  return {
    id,
    store_code: d.store_code ?? "",
    store_name: d.store_name ?? "",
    owner_uid: d.owner_uid ?? id,
    owner_name: d.owner_name ?? "",
    owner_phone: d.owner_phone ?? "",
    owner_gcash: d.owner_gcash ?? "",
    address: d.address ?? "",
    gcash_number_for_business: d.gcash_number_for_business ?? "",
    subscription_plan: "monthly_210",
    subscription_status: d.subscription_status ?? "trial",
    subscription_start: d.subscription_start ?? null,
    subscription_end: d.subscription_end ?? null,
    trial_end: d.trial_end,
    deactivated: !!d.deactivated,
    gcash_fund: Number(d.gcash_fund ?? 0),
    cash_float: Number(d.cash_float ?? 0),
    low_fund_threshold: Number(d.low_fund_threshold ?? 3000),
    fee_per_500: Number(d.fee_per_500 ?? DEFAULT_FEES.fee_per_500),
    load_fee: Number(d.load_fee ?? DEFAULT_FEES.load_fee),
    stats: {
      day: d.stats?.day ?? "",
      profit_today: Number(d.stats?.profit_today ?? 0),
      commission_today: Number(d.stats?.commission_today ?? 0),
      txn_today: Number(d.stats?.txn_today ?? 0),
    },
    referred_by: d.referred_by ?? null,
    referral_rewarded: !!d.referral_rewarded,
    created_at: d.created_at,
  };
}

/** Stats reset to zero when the Manila day changes. */
export function todayStats(s: Store) {
  return s.stats.day === manilaDay() ? s.stats : { day: manilaDay(), profit_today: 0, commission_today: 0, txn_today: 0 };
}

export interface SignupInput {
  storeName: string;
  ownerName: string;
  phone: string;
  password: string;
  address: string;
  gcashBusiness: string;
  ownerGcash: string;
  referralCode?: string;
}

/**
 * Owner self sign-up: Auth user -> store doc (id = uid) + users doc + unique store code.
 * Rolls back the Auth user if Firestore writes fail so the phone can be reused.
 */
export async function signupOwner(input: SignupInput): Promise<string> {
  // Resolve referral before creating anything so a bad code fails fast.
  let referredBy: string | null = null;
  if (input.referralCode?.trim()) {
    const ref = await getDoc(doc(db, "store_codes", input.referralCode.trim().toUpperCase()));
    if (!ref.exists()) throw new Error("Hindi valid ang referral code.");
    referredBy = ref.data().store_id as string;
  }

  const cred = await createUserWithEmailAndPassword(auth, ownerEmail(input.phone), input.password);
  const uid = cred.user.uid;
  const trialEnd = addDays(new Date(), TRIAL_DAYS);

  let lastErr: unknown;
  // Retry with a new code if the generated store code is already taken.
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = makeStoreCode(input.storeName);
    const batch = writeBatch(db);
    batch.set(doc(db, "stores", uid), {
      store_code: code,
      store_name: input.storeName.trim(),
      owner_uid: uid,
      owner_name: input.ownerName.trim(),
      owner_phone: input.phone,
      owner_gcash: input.ownerGcash,
      address: input.address.trim(),
      gcash_number_for_business: input.gcashBusiness,
      subscription_plan: "monthly_210",
      subscription_status: "trial",
      subscription_start: null,
      subscription_end: null,
      trial_end: ts(trialEnd),
      deactivated: false,
      gcash_fund: 0,
      cash_float: 0,
      low_fund_threshold: 3000,
      fee_per_500: DEFAULT_FEES.fee_per_500,
      load_fee: DEFAULT_FEES.load_fee,
      stats: { day: manilaDay(), profit_today: 0, commission_today: 0, txn_today: 0 },
      referred_by: referredBy,
      referral_rewarded: false,
      created_at: serverTimestamp(),
    });
    batch.set(doc(db, "users", uid), {
      role: "store_owner",
      store_id: uid,
      name: input.ownerName.trim(),
      phone: input.phone,
      created_at: serverTimestamp(),
    });
    batch.set(doc(db, "store_codes", code), { store_id: uid, created_at: serverTimestamp() });
    try {
      await batch.commit();
      return uid;
    } catch (e) {
      lastErr = e;
      // permission-denied here usually means the store code already exists -> retry.
      if ((e as { code?: string }).code !== "permission-denied") break;
    }
  }
  await deleteUser(cred.user).catch(() => undefined);
  throw lastErr ?? new Error("Hindi ma-create ang store. Subukan ulit.");
}

export function watchStore(storeId: string, cb: (s: Store | null) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    doc(db, "stores", storeId),
    (snap) => cb(snap.exists() ? storeFromDoc(snap.id, snap.data()) : null),
    (e) => onErr?.(e),
  );
}

export function watchAllStores(cb: (s: Store[]) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, "stores"), orderBy("created_at", "desc")),
    (snap) => cb(snap.docs.map((d) => storeFromDoc(d.id, d.data()))),
    (e) => onErr?.(e),
  );
}

export type StoreInfoPatch = Partial<
  Pick<
    Store,
    | "store_name"
    | "owner_name"
    | "owner_phone"
    | "owner_gcash"
    | "address"
    | "gcash_number_for_business"
    | "gcash_fund"
    | "cash_float"
    | "low_fund_threshold"
    | "fee_per_500"
    | "load_fee"
  >
>;

export async function updateStoreInfo(storeId: string, patch: StoreInfoPatch): Promise<void> {
  await updateDoc(doc(db, "stores", storeId), patch);
}

const DEFAULT_CONFIG: AppConfig = {
  admin_name: import.meta.env.VITE_ADMIN_NAME || "Moises Gamboa",
  admin_gcash: import.meta.env.VITE_ADMIN_GCASH || "0918XXXXXXX",
  monthly_price: 210,
  daily_price: 7,
};

export function watchConfig(cb: (c: AppConfig) => void): Unsubscribe {
  return onSnapshot(
    doc(db, "config", "app"),
    (snap) => cb({ ...DEFAULT_CONFIG, ...(snap.exists() ? (snap.data() as Partial<AppConfig>) : {}) }),
    () => cb(DEFAULT_CONFIG),
  );
}

export { DEFAULT_CONFIG };
