import type { Timestamp } from "firebase/firestore";

export interface Child {
  id: string;
  name: string;
  birthday: string; // YYYY-MM-DD
  sex: "Lalaki" | "Babae";
  purok: string;
  parentId: string;
  parentName: string;
  parentContact: string;
  /** vaccine code → date given (YYYY-MM-DD) */
  vaccines: Record<string, string>;
  notes: string;
  createdAt?: Timestamp;
}

export interface Pregnancy {
  id: string;
  name: string;
  userId: string;
  purok: string;
  contact: string;
  dueDate: string;
  nextCheckup: string;
  checkups: string[];
  status: "active" | "delivered";
  notes: string;
  createdAt?: Timestamp;
}

/** Routine immunization for babies (DOH Expanded Program on Immunization). */
export const VACCINES: { code: string; label: string; ageDays: number; group: string }[] = [
  { code: "bcg", label: "BCG", ageDays: 0, group: "Pagkapanganak" },
  { code: "hepb", label: "Hepa B", ageDays: 0, group: "Pagkapanganak" },
  { code: "penta1", label: "Penta 1", ageDays: 42, group: "6 linggo" },
  { code: "opv1", label: "OPV 1", ageDays: 42, group: "6 linggo" },
  { code: "pcv1", label: "PCV 1", ageDays: 42, group: "6 linggo" },
  { code: "penta2", label: "Penta 2", ageDays: 70, group: "10 linggo" },
  { code: "opv2", label: "OPV 2", ageDays: 70, group: "10 linggo" },
  { code: "pcv2", label: "PCV 2", ageDays: 70, group: "10 linggo" },
  { code: "penta3", label: "Penta 3", ageDays: 98, group: "14 linggo" },
  { code: "opv3", label: "OPV 3", ageDays: 98, group: "14 linggo" },
  { code: "pcv3", label: "PCV 3", ageDays: 98, group: "14 linggo" },
  { code: "ipv", label: "IPV", ageDays: 98, group: "14 linggo" },
  { code: "mmr1", label: "MMR 1", ageDays: 270, group: "9 buwan" },
  { code: "mmr2", label: "MMR 2", ageDays: 365, group: "12 buwan" },
];

export type DoseState = "done" | "overdue" | "due" | "upcoming";

function dayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dueDate(birthday: string, ageDays: number): Date {
  const b = new Date(`${birthday}T00:00:00`);
  return new Date(b.getFullYear(), b.getMonth(), b.getDate() + ageDays);
}

/** done / overdue (past due, not given) / due (within the next 14 days) / upcoming. */
export function doseState(child: Pick<Child, "birthday" | "vaccines">, code: string, now = new Date()): DoseState {
  if (child.vaccines?.[code]) return "done";
  const v = VACCINES.find((x) => x.code === code);
  if (!v) return "upcoming";
  const due = dayStart(dueDate(child.birthday, v.ageDays));
  const today = dayStart(now);
  if (due < today) return "overdue";
  if (due - today <= 14 * 86_400_000) return "due";
  return "upcoming";
}

export function childSummary(child: Child, now = new Date()) {
  const states = VACCINES.map((v) => ({ v, state: doseState(child, v.code, now) }));
  const next = states.find((s) => s.state !== "done");
  return {
    done: states.filter((s) => s.state === "done").length,
    overdue: states.filter((s) => s.state === "overdue"),
    due: states.filter((s) => s.state === "due"),
    next: next ? { ...next, date: dueDate(child.birthday, next.v.ageDays) } : null,
    complete: !next,
  };
}

export function ageText(birthday: string, now = new Date()): string {
  const b = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(b.getTime())) return "";
  const months = (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth() - (now.getDate() < b.getDate() ? 1 : 0);
  if (months < 1) return `${Math.max(0, Math.floor((now.getTime() - b.getTime()) / 86_400_000))} araw`;
  if (months < 24) return `${months} buwan`;
  return `${Math.floor(months / 12)} taon`;
}

export function shortDate(d: Date | string): string {
  const x = typeof d === "string" ? new Date(`${d}T00:00:00`) : d;
  return x.toLocaleDateString("fil-PH", { month: "short", day: "numeric", year: "numeric" });
}

/** Weeks of pregnancy from the due date (40 weeks). */
export function weeksPregnant(dueDateIso: string, now = new Date()): number | null {
  const due = new Date(`${dueDateIso}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  return Math.max(0, Math.min(42, 40 - Math.ceil((due.getTime() - now.getTime()) / (7 * 86_400_000))));
}
