import { storeProfit } from "./fees";
import { manilaDay } from "./format";
import type { Transaction } from "./types";

export type ReportRange = "daily" | "weekly" | "monthly";

export interface ReportRow {
  key: string;
  label: string;
  count: number;
  cash_in: number;
  cash_out: number;
  load: number;
  fees: number;
  commission: number;
  profit: number;
}

/** Monday of the Manila week containing `day` (yyyy-mm-dd). */
function weekKey(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function bucketKey(date: Date, range: ReportRange): string {
  const day = manilaDay(date);
  if (range === "daily") return day;
  if (range === "weekly") return weekKey(day);
  return day.slice(0, 7);
}

export function rangeStart(range: ReportRange, now = new Date()): Date {
  const day = manilaDay(now);
  if (range === "daily") return new Date(new Date(`${day}T00:00:00+08:00`).getTime() - 13 * 86_400_000);
  if (range === "weekly") return new Date(new Date(`${weekKey(day)}T00:00:00+08:00`).getTime() - 7 * 7 * 86_400_000);
  const [y, m] = day.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1 - 5, 1));
  return new Date(`${start.toISOString().slice(0, 7)}-01T00:00:00+08:00`);
}

/** Group approved transactions into report rows, newest first. */
export function buildReport(txns: Transaction[], range: ReportRange, dateOf: (t: Transaction) => Date | null): ReportRow[] {
  const map = new Map<string, ReportRow>();
  for (const t of txns) {
    if (t.status !== "approved") continue;
    const d = dateOf(t);
    if (!d) continue;
    const key = bucketKey(d, range);
    const r = map.get(key) ?? { key, label: labelFor(key, range), count: 0, cash_in: 0, cash_out: 0, load: 0, fees: 0, commission: 0, profit: 0 };
    r.count++;
    r[t.type] += t.amount;
    r.fees += t.fee;
    r.commission += t.commission;
    r.profit += storeProfit(t.fee, t.commission);
    map.set(key, r);
  }
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}

function labelFor(key: string, range: ReportRange): string {
  if (range === "monthly") {
    const [y, m] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
  }
  const d = new Date(`${key}T12:00:00Z`);
  const s = d.toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
  return range === "weekly" ? `Week of ${s}` : s;
}
