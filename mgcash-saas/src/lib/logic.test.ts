import { describe, expect, it } from "vitest";
import { getSubStatus, daysLeft, extendSubscription, daysForAmount, isLocked, addDays } from "./subscription";
import { balanceDelta, computeFee, storeProfit } from "./fees";
import { computePayroll } from "./payroll";
import { buildReport } from "./reports";
import { normalizePhone, PHONE_RE } from "./format";
import { tinderaEmail, ownerEmail, makeStoreCode } from "./authEmail";
import type { Transaction } from "./types";

const NOW = new Date("2026-10-07T04:00:00Z");

describe("subscription status", () => {
  it("new store is on trial", () => {
    expect(getSubStatus({ trial_end: addDays(NOW, 5), subscription_end: null, deactivated: false }, NOW)).toBe("trial");
  });
  it("trial ended, never paid -> expired + locked", () => {
    const s = getSubStatus({ trial_end: addDays(NOW, -1), subscription_end: null, deactivated: false }, NOW);
    expect(s).toBe("expired");
    expect(isLocked(s)).toBe(true);
  });
  it("paid -> active", () => {
    expect(getSubStatus({ trial_end: addDays(NOW, -40), subscription_end: addDays(NOW, 10), deactivated: false }, NOW)).toBe("active");
  });
  it("within 3-day grace -> overdue (not locked)", () => {
    const s = getSubStatus({ trial_end: addDays(NOW, -40), subscription_end: addDays(NOW, -2), deactivated: false }, NOW);
    expect(s).toBe("overdue");
    expect(isLocked(s)).toBe(false);
  });
  it("past grace -> expired", () => {
    expect(getSubStatus({ trial_end: addDays(NOW, -40), subscription_end: addDays(NOW, -4), deactivated: false }, NOW)).toBe("expired");
  });
  it("deactivated wins over everything", () => {
    expect(getSubStatus({ trial_end: addDays(NOW, 5), subscription_end: addDays(NOW, 30), deactivated: true }, NOW)).toBe("deactivated");
  });
  it("daysLeft ceil", () => {
    expect(daysLeft({ trial_end: addDays(NOW, 4.2), subscription_end: null, deactivated: false }, NOW)).toBe(5);
  });
  it("extends from current end if still in future (no lost days)", () => {
    const end = addDays(NOW, 10);
    expect(extendSubscription(end, 30, NOW).getTime()).toBe(addDays(NOW, 40).getTime());
  });
  it("extends from now if already expired", () => {
    expect(extendSubscription(addDays(NOW, -10), 30, NOW).getTime()).toBe(addDays(NOW, 30).getTime());
  });
  it("amount -> days", () => {
    expect(daysForAmount(210)).toBe(30);
    expect(daysForAmount(420)).toBe(60);
    expect(daysForAmount(70)).toBe(10);
    expect(daysForAmount(0)).toBe(0);
  });
});

describe("fees and balances", () => {
  it("cash fee per started P500 block", () => {
    expect(computeFee("cash_in", 100)).toBe(10);
    expect(computeFee("cash_in", 500)).toBe(10);
    expect(computeFee("cash_in", 501)).toBe(20);
    expect(computeFee("cash_out", 2000)).toBe(40);
    expect(computeFee("load", 50)).toBe(3);
    expect(computeFee("cash_in", -5)).toBe(0);
  });
  it("balance deltas", () => {
    expect(balanceDelta("cash_in", 1000, 20)).toEqual({ gcash: -1000, cash: 1020 });
    expect(balanceDelta("cash_out", 1000, 20)).toEqual({ gcash: 1000, cash: -980 });
    expect(balanceDelta("load", 100, 3)).toEqual({ gcash: -100, cash: 103 });
  });
  it("store profit = fee - commission", () => {
    expect(storeProfit(20, 2)).toBe(18);
  });
});

describe("payroll", () => {
  it("semi-monthly halves base, subtracts deductions", () => {
    const r = computePayroll({ base_salary: 4500, bonus: 500, commissions: [2, 2, 1], deductions: [200], cutoff: "semi" });
    expect(r).toEqual({ base: 2250, commission: 5, bonus: 500, deductions: 200, net: 2555 });
  });
  it("net never negative", () => {
    expect(computePayroll({ base_salary: 0, bonus: 0, commissions: [], deductions: [999], cutoff: "monthly" }).net).toBe(0);
  });
});

describe("reports", () => {
  const t = (over: Partial<Transaction>, at: string): Transaction & { _at: Date } =>
    ({ type: "cash_in", amount: 1000, fee: 20, commission: 2, status: "approved", ...over, _at: new Date(at) }) as Transaction & { _at: Date };
  it("groups by Manila day and ignores non-approved", () => {
    const rows = buildReport(
      [
        t({}, "2026-10-06T15:30:00Z"), // Oct 6 23:30 Manila
        t({}, "2026-10-06T16:30:00Z"), // Oct 7 00:30 Manila
        t({ status: "rejected" }, "2026-10-06T16:40:00Z"),
      ],
      "daily",
      (x) => (x as Transaction & { _at: Date })._at,
    );
    expect(rows.map((r) => [r.key, r.count, r.profit])).toEqual([
      ["2026-10-07", 1, 18],
      ["2026-10-06", 1, 18],
    ]);
  });
});

describe("auth helpers", () => {
  it("phone normalisation", () => {
    expect(normalizePhone("+63 917 123 4567")).toBe("09171234567");
    expect(PHONE_RE.test("09171234567")).toBe(true);
    expect(PHONE_RE.test("9171234567")).toBe(false);
  });
  it("synthetic emails are stable + lowercase", () => {
    expect(ownerEmail("09171234567")).toBe("09171234567@owner.mgcash.app");
    expect(tinderaEmail("NENA-4821", " Joy ")).toBe("joy.nena-4821@tindera.mgcash.app");
  });
  it("store code format", () => {
    expect(makeStoreCode("Nena Sari-Sari Store")).toMatch(/^NENA-\d{4}$/);
    expect(makeStoreCode("7-11")).toMatch(/^XXX-\d{4}$/);
  });
});
