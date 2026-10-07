import type { SubStatus } from "./types";

export const TRIAL_DAYS = 7;
export const PERIOD_DAYS = 30;
/** Days after subscription_end where the store still works but is flagged Overdue. */
export const GRACE_DAYS = 3;
const DAY_MS = 86_400_000;

export interface SubDates {
  trial_end: Date;
  subscription_end: Date | null;
  deactivated: boolean;
}

/**
 * Single source of truth for subscription status. Mirrors `storeActive()` in firestore.rules:
 * the store can transact while status is trial / active / overdue.
 */
export function getSubStatus(d: SubDates, now: Date = new Date()): SubStatus {
  if (d.deactivated) return "deactivated";
  const t = now.getTime();
  if (d.subscription_end && d.subscription_end.getTime() > t) return "active";
  if (d.subscription_end && d.subscription_end.getTime() + GRACE_DAYS * DAY_MS > t) return "overdue";
  if (d.trial_end.getTime() > t) return "trial";
  return "expired";
}

export function isLocked(status: SubStatus): boolean {
  return status === "expired" || status === "deactivated";
}

/** Whole days left (ceil) until the relevant end date; 0 if past. */
export function daysLeft(d: SubDates, now: Date = new Date()): number {
  const end = d.subscription_end && d.subscription_end > d.trial_end ? d.subscription_end : d.trial_end;
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
}

/** Next due date shown in billing: subscription end, or trial end if never paid. */
export function nextDueDate(d: SubDates): Date {
  return d.subscription_end ?? d.trial_end;
}

/**
 * New subscription_end after a payment of `days`. Extends from the current end if still in
 * the future (no lost days for early payers), otherwise from now.
 */
export function extendSubscription(currentEnd: Date | null, days: number, now: Date = new Date()): Date {
  const base = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  return new Date(base.getTime() + days * DAY_MS);
}

/** Days covered by an amount: P210 = 30 days, else P7/day. */
export function daysForAmount(amount: number, monthlyPrice = 210, dailyPrice = 7): number {
  if (amount <= 0) return 0;
  if (amount % monthlyPrice === 0) return (amount / monthlyPrice) * PERIOD_DAYS;
  return Math.floor(amount / dailyPrice);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export const STATUS_LABEL: Record<SubStatus, string> = {
  trial: "Trial",
  active: "Active",
  overdue: "Overdue",
  expired: "Expired",
  deactivated: "Deactivated",
};
