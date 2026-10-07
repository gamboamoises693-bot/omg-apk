/**
 * Firestore security rules tests - proves multi-tenant isolation.
 * Run: npm run test:rules   (starts the Firestore emulator; needs Java 11+)
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { Timestamp, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";

let env: RulesTestEnvironment;
const DAY = 86_400_000;
const future = (days: number) => Timestamp.fromMillis(Date.now() + days * DAY);

const storeDoc = (uid: string, over: Record<string, unknown> = {}) => ({
  store_code: `S-${uid}`,
  store_name: `Store ${uid}`,
  owner_uid: uid,
  subscription_status: "trial",
  subscription_end: null,
  trial_end: future(7),
  deactivated: false,
  referral_rewarded: false,
  gcash_fund: 15000,
  cash_float: 3000,
  ...over,
});

const tinderaDoc = (store: string) => ({
  store_id: store,
  name: "Joy",
  username: "joy",
  base_salary: 4500,
  commission_cash: 2,
  commission_load: 1,
  bonus: 500,
  active: true,
});

const keypadTxn = (store: string, tindera: string, over: Record<string, unknown> = {}) => ({
  store_id: store,
  store_name: "Store",
  tindera_id: tindera,
  tindera_name: "Joy",
  shift_id: "s1",
  type: "cash_in",
  amount: 1000,
  fee: 20,
  commission: 2,
  customer_number: "09171234567",
  number_source: "keypad",
  number_status: "locked",
  number_locked_at: serverTimestamp(),
  status: "pending",
  created_at: serverTimestamp(),
  ...over,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-mgcash",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "stores/ownerA"), storeDoc("ownerA"));
    await setDoc(doc(db, "stores/ownerB"), storeDoc("ownerB"));
    await setDoc(doc(db, "stores/expired"), storeDoc("expired", { trial_end: future(-1) }));
    await setDoc(doc(db, "stores/ownerA/tinderas/tinA"), tinderaDoc("ownerA"));
    await setDoc(doc(db, "stores/ownerA/tinderas/tinA2"), tinderaDoc("ownerA"));
    await setDoc(doc(db, "stores/ownerB/tinderas/tinB"), tinderaDoc("ownerB"));
    await setDoc(doc(db, "stores/expired/tinderas/tinX"), tinderaDoc("expired"));
    await setDoc(doc(db, "stores/ownerB/transactions/tB1"), { ...keypadTxn("ownerB", "tinB"), created_at: Timestamp.now(), number_locked_at: Timestamp.now() });
    await setDoc(doc(db, "stores/ownerA/transactions/tA1"), { ...keypadTxn("ownerA", "tinA"), created_at: Timestamp.now(), number_locked_at: Timestamp.now() });
    await setDoc(doc(db, "stores/ownerA/transactions/qr1"), {
      ...keypadTxn("ownerA", "tinA"),
      customer_number: "",
      number_source: "qr",
      number_status: "waiting",
      number_locked_at: null,
      status: "awaiting_number",
      created_at: Timestamp.now(),
    });
  });
});

const as = (uid: string, claims: Record<string, unknown> = {}) => env.authenticatedContext(uid, claims).firestore();

describe("tenant isolation", () => {
  it("owner reads own store, not another store", async () => {
    await assertSucceeds(getDoc(doc(as("ownerA"), "stores/ownerA")));
    await assertFails(getDoc(doc(as("ownerA"), "stores/ownerB")));
  });

  it("owner cannot read another store's transactions or tinderas", async () => {
    await assertFails(getDoc(doc(as("ownerA"), "stores/ownerB/transactions/tB1")));
    await assertFails(getDocs(collection(as("ownerA"), "stores/ownerB/transactions")));
    await assertFails(getDocs(collection(as("ownerA"), "stores/ownerB/tinderas")));
  });

  it("tindera cannot read another store", async () => {
    await assertFails(getDoc(doc(as("tinA"), "stores/ownerB")));
    await assertFails(getDoc(doc(as("tinA"), "stores/ownerB/transactions/tB1")));
  });

  it("tindera lists only her own transactions", async () => {
    const db = as("tinA2");
    await assertFails(getDocs(collection(db, "stores/ownerA/transactions")));
    await assertSucceeds(getDocs(query(collection(db, "stores/ownerA/transactions"), where("tindera_id", "==", "tinA2"))));
    await assertFails(getDoc(doc(db, "stores/ownerA/transactions/tA1")));
  });

  it("superadmin reads every store", async () => {
    const db = as("moises", { superadmin: true });
    await assertSucceeds(getDoc(doc(db, "stores/ownerB")));
    await assertSucceeds(getDocs(collection(db, "stores/ownerB/transactions")));
  });

  it("a normal user cannot list all stores", async () => {
    await assertFails(getDocs(collection(as("ownerA"), "stores")));
  });
});

describe("sign up + subscription protection", () => {
  it("owner can create own store with 7-day trial", async () => {
    await assertSucceeds(setDoc(doc(as("newOwner"), "stores/newOwner"), storeDoc("newOwner")));
  });

  it("owner cannot give herself a long trial or create someone else's store", async () => {
    await assertFails(setDoc(doc(as("newOwner"), "stores/newOwner"), storeDoc("newOwner", { trial_end: future(60) })));
    await assertFails(setDoc(doc(as("newOwner"), "stores/other"), storeDoc("other")));
    await assertFails(setDoc(doc(as("newOwner"), "stores/newOwner"), storeDoc("newOwner", { subscription_status: "active" })));
  });

  it("owner cannot extend subscription or un-deactivate herself", async () => {
    const db = as("ownerA");
    await assertFails(updateDoc(doc(db, "stores/ownerA"), { subscription_end: future(365) }));
    await assertFails(updateDoc(doc(db, "stores/ownerA"), { trial_end: future(30) }));
    await assertSucceeds(updateDoc(doc(db, "stores/ownerA"), { store_name: "Nena Store", gcash_fund: 20000 }));
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), "stores/ownerA"), { deactivated: true }));
    await assertFails(updateDoc(doc(db, "stores/ownerA"), { deactivated: false }));
  });

  it("superadmin can mark paid", async () => {
    await assertSucceeds(updateDoc(doc(as("moises", { superadmin: true }), "stores/ownerA"), { subscription_end: future(30), subscription_status: "active" }));
  });

  it("users doc: cannot claim another store", async () => {
    await assertSucceeds(setDoc(doc(as("ownerC"), "users/ownerC"), { role: "store_owner", store_id: "ownerC" }));
    await assertFails(setDoc(doc(as("ownerC2"), "users/ownerC2"), { role: "store_owner", store_id: "ownerA" }));
    await assertFails(setDoc(doc(as("ownerC3"), "users/ownerC3"), { role: "tindera", store_id: "ownerA" }));
  });

  it("owner registers tindera user only for her own store", async () => {
    await assertSucceeds(setDoc(doc(as("ownerA"), "users/newTin"), { role: "tindera", store_id: "ownerA" }));
    await assertFails(setDoc(doc(as("ownerA"), "users/newTin2"), { role: "tindera", store_id: "ownerB" }));
  });

  it("owner can only file payments for own store", async () => {
    await assertSucceeds(setDoc(doc(as("ownerA"), "payments/p1"), { store_id: "ownerA", amount: 210, status: "pending" }));
    await assertFails(setDoc(doc(as("ownerA"), "payments/p2"), { store_id: "ownerB", amount: 210, status: "pending" }));
    await assertFails(setDoc(doc(as("ownerA"), "payments/p3"), { store_id: "ownerA", amount: 210, status: "paid" }));
  });
});

describe("transactions", () => {
  it("tindera creates keypad txn with correct commission", async () => {
    await assertSucceeds(setDoc(doc(as("tinA"), "stores/ownerA/transactions/n1"), keypadTxn("ownerA", "tinA")));
  });

  it("tindera cannot inflate commission or post as someone else", async () => {
    await assertFails(setDoc(doc(as("tinA"), "stores/ownerA/transactions/n2"), keypadTxn("ownerA", "tinA", { commission: 50 })));
    await assertFails(setDoc(doc(as("tinA"), "stores/ownerA/transactions/n3"), keypadTxn("ownerA", "tinA2")));
    await assertFails(setDoc(doc(as("tinA"), "stores/ownerB/transactions/n4"), keypadTxn("ownerB", "tinA")));
  });

  it("tindera cannot create a pre-approved txn or bad number", async () => {
    await assertFails(setDoc(doc(as("tinA"), "stores/ownerA/transactions/n5"), keypadTxn("ownerA", "tinA", { status: "approved" })));
    await assertFails(setDoc(doc(as("tinA"), "stores/ownerA/transactions/n6"), keypadTxn("ownerA", "tinA", { customer_number: "12345" })));
  });

  it("tindera cannot edit the locked number", async () => {
    await assertFails(updateDoc(doc(as("tinA"), "stores/ownerA/transactions/tA1"), { customer_number: "09999999999" }));
  });

  it("expired store blocks new transactions", async () => {
    await assertFails(setDoc(doc(as("tinX"), "stores/expired/transactions/x1"), keypadTxn("expired", "tinX")));
  });

  it("disabled tindera loses access", async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), "stores/ownerA/tinderas/tinA"), { active: false }));
    await assertFails(getDoc(doc(as("tinA"), "stores/ownerA")));
    await assertFails(setDoc(doc(as("tinA"), "stores/ownerA/transactions/n7"), keypadTxn("ownerA", "tinA")));
  });

  it("owner approves but cannot change number/amount", async () => {
    const db = as("ownerA");
    await assertFails(updateDoc(doc(db, "stores/ownerA/transactions/tA1"), { status: "approved", amount: 1 }));
    await assertFails(updateDoc(doc(db, "stores/ownerA/transactions/tA1"), { status: "approved", customer_number: "09999999999" }));
    await assertSucceeds(updateDoc(doc(db, "stores/ownerA/transactions/tA1"), { status: "approved", decided_at: serverTimestamp(), decided_by: "ownerA" }));
    // already decided -> cannot flip again
    await assertFails(updateDoc(doc(db, "stores/ownerA/transactions/tA1"), { status: "rejected" }));
  });

  it("owner of another store cannot approve", async () => {
    await assertFails(updateDoc(doc(as("ownerB"), "stores/ownerA/transactions/tA1"), { status: "approved" }));
  });
});

describe("public customer QR page", () => {
  const pub = () => env.unauthenticatedContext().firestore();
  const lock = (n = "09171234567") => ({ customer_number: n, number_status: "locked", number_locked_at: serverTimestamp(), status: "pending" });

  it("customer can read the waiting txn and lock a number once", async () => {
    await assertSucceeds(getDoc(doc(pub(), "stores/ownerA/transactions/qr1")));
    await assertSucceeds(updateDoc(doc(pub(), "stores/ownerA/transactions/qr1"), lock()));
    // second attempt (e.g. tindera re-opening the link) fails
    await assertFails(updateDoc(doc(pub(), "stores/ownerA/transactions/qr1"), lock("09999999999")));
    await assertFails(getDoc(doc(pub(), "stores/ownerA/transactions/qr1")));
  });

  it("customer cannot change amount or approve", async () => {
    await assertFails(updateDoc(doc(pub(), "stores/ownerA/transactions/qr1"), { ...lock(), amount: 1 }));
    await assertFails(updateDoc(doc(pub(), "stores/ownerA/transactions/qr1"), { ...lock(), status: "approved" }));
    await assertFails(updateDoc(doc(pub(), "stores/ownerA/transactions/qr1"), lock("1234")));
  });

  it("public cannot read locked txns or list anything", async () => {
    await assertFails(getDoc(doc(pub(), "stores/ownerA/transactions/tA1")));
    await assertFails(getDocs(collection(pub(), "stores/ownerA/transactions")));
    await assertFails(getDoc(doc(pub(), "stores/ownerA")));
  });

  it("QR expires after 15 minutes", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), "stores/ownerA/transactions/qr1"), { created_at: Timestamp.fromMillis(Date.now() - 16 * 60_000) }),
    );
    await assertFails(updateDoc(doc(pub(), "stores/ownerA/transactions/qr1"), lock()));
  });
});
