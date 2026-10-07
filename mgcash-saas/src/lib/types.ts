import type { Timestamp } from "firebase/firestore";

export type Role = "superadmin" | "store_owner" | "tindera";

/** Effective subscription state, derived from dates (see lib/subscription.ts). */
export type SubStatus = "trial" | "active" | "overdue" | "expired" | "deactivated";

export type TxnType = "cash_in" | "cash_out" | "load";
export type TxnStatus = "awaiting_number" | "pending" | "approved" | "rejected" | "cancelled";
export type NumberSource = "qr" | "keypad";

export interface StoreStats {
  /** yyyy-mm-dd (Asia/Manila) the counters belong to; reset when the day changes. */
  day: string;
  profit_today: number;
  commission_today: number;
  txn_today: number;
}

export interface Store {
  id: string; // == owner uid
  store_code: string;
  store_name: string;
  owner_uid: string;
  owner_name: string;
  owner_phone: string;
  owner_gcash: string;
  address: string;
  gcash_number_for_business: string;
  subscription_plan: "monthly_210";
  subscription_status: "trial" | "active";
  subscription_start: Timestamp | null;
  subscription_end: Timestamp | null;
  trial_end: Timestamp;
  deactivated: boolean;
  gcash_fund: number;
  cash_float: number;
  low_fund_threshold: number;
  /** Fee charged to customer for cash in/out per P500 block (min 1 block). */
  fee_per_500: number;
  /** Fee charged on top of load amount. */
  load_fee: number;
  stats: StoreStats;
  referred_by: string | null;
  referral_rewarded: boolean;
  created_at: Timestamp;
}

export interface UserProfile {
  uid: string;
  role: Exclude<Role, "superadmin">;
  store_id: string;
  name: string;
  phone?: string;
  username?: string;
}

export interface Tindera {
  id: string; // == tindera auth uid
  store_id: string;
  name: string;
  username: string;
  phone: string;
  base_salary: number;
  commission_cash: number;
  commission_load: number;
  bonus: number;
  active: boolean;
  created_at: Timestamp;
}

export interface Transaction {
  id: string;
  store_id: string;
  store_name: string;
  tindera_id: string;
  tindera_name: string;
  shift_id: string;
  type: TxnType;
  amount: number;
  fee: number;
  commission: number;
  customer_number: string;
  number_source: NumberSource;
  number_status: "waiting" | "locked";
  number_locked_at: Timestamp | null;
  status: TxnStatus;
  created_at: Timestamp;
  decided_at?: Timestamp | null;
  decided_by?: string;
  reject_reason?: string;
}

export interface Shift {
  id: string;
  store_id: string;
  tindera_id: string;
  tindera_name: string;
  status: "open" | "closed";
  start_at: Timestamp;
  start_photo_id: string;
  start_cash: number;
  end_at?: Timestamp;
  end_photo_id?: string;
  end_cash?: number;
  expected_cash?: number;
  /** Positive = kulang (short), negative = sobra (over). */
  shortage?: number;
  end_note?: string;
  txn_count?: number;
  commission_total?: number;
  audit_status?: "pending" | "approved" | "deducted";
  deduction?: number;
  audit_note?: string;
  audited_at?: Timestamp;
}

export interface Payment {
  id: string;
  store_id: string;
  store_name: string;
  amount: number;
  gcash_ref: string;
  status: "pending" | "paid" | "rejected";
  has_proof: boolean;
  source: "owner_upload" | "admin_manual";
  note?: string;
  created_at: Timestamp;
  paid_at?: Timestamp | null;
  period_end?: Timestamp | null;
}

export interface Payroll {
  id: string;
  store_id: string;
  tindera_id: string;
  tindera_name: string;
  period_start: Timestamp;
  period_end: Timestamp;
  base: number;
  commission: number;
  bonus: number;
  deductions: number;
  net: number;
  paid: boolean;
  created_at: Timestamp;
}

export interface AppConfig {
  admin_name: string;
  admin_gcash: string;
  monthly_price: number;
  daily_price: number;
}
