import type { TxnType } from "./types";

export interface FeeSettings {
  fee_per_500: number;
  load_fee: number;
}

export const DEFAULT_FEES: FeeSettings = { fee_per_500: 10, load_fee: 3 };

/** Customer fee. Cash in/out: fee_per_500 per started P500 block (P1-500 = 1 block). */
export function computeFee(type: TxnType, amount: number, s: FeeSettings = DEFAULT_FEES): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (type === "load") return s.load_fee;
  return Math.ceil(amount / 500) * s.fee_per_500;
}

/**
 * Effect of an approved transaction on store balances.
 *  cash_in : customer hands cash (amount+fee), store sends GCash amount
 *  cash_out: customer sends GCash amount, store hands cash (amount-fee)
 *  load    : customer hands cash (amount+fee), store spends GCash amount on load
 */
export function balanceDelta(type: TxnType, amount: number, fee: number): { gcash: number; cash: number } {
  switch (type) {
    case "cash_in":
    case "load":
      return { gcash: -amount, cash: amount + fee };
    case "cash_out":
      return { gcash: amount, cash: -(amount - fee) };
  }
}

/** Store profit for one txn = customer fee minus tindera commission. */
export function storeProfit(fee: number, commission: number): number {
  return fee - commission;
}

export const TXN_LABEL: Record<TxnType, string> = {
  cash_in: "Cash In",
  cash_out: "Cash Out",
  load: "Load",
};
