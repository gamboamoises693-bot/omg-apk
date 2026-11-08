import type { AmbulanceAvailability, AmbulanceRequest, AmbulanceRequestStatus, AmbulanceSlot } from "./types";

export const AMBULANCE_REASONS = ["Check-up", "Dialysis", "Therapy", "Panganganak", "Paglipat ng ospital", "Iba pa"] as const;

/** Trip length choices for the admin (hours). Used to block the schedule. */
export const DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12] as const;
export const DEFAULT_DURATION = { emergency: 2, schedule: 3 } as const;

export const AVAILABILITY_LABEL: Record<AmbulanceAvailability, string> = {
  available: "Available ngayon",
  busy: "Nasa biyahe",
  maintenance: "Under maintenance",
};

export const REQUEST_STATUS_LABEL: Record<AmbulanceRequestStatus, string> = {
  pending: "Naghihintay",
  approved: "Naka-schedule",
  enroute: "Papunta na",
  done: "Tapos",
  rejected: "Hindi naaprubahan",
  cancelled: "Na-cancel",
};

/** Statuses that occupy the ambulance (block the schedule). */
export const ACTIVE_STATUSES: AmbulanceRequestStatus[] = ["approved", "enroute"];

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function fromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "13:05" -> "1:05 PM" */
export function formatTime12(hhmm: string): string {
  if (!hhmm) return "";
  const mins = toMinutes(hhmm);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function endTime(start: string, hours: number): string {
  return fromMinutes(toMinutes(start) + hours * 60);
}

/** True when [aStart, aEnd) overlaps [bStart, bEnd). Same-day windows only. */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

/** Busy window that contains the given time, if any. */
export function findBusySlot(slots: AmbulanceSlot[], date: string, time: string): AmbulanceSlot | undefined {
  const t = toMinutes(time);
  return slots.find((s) => s.date === date && t >= toMinutes(s.start) && t < toMinutes(s.end));
}

/** Other active trips on the same date that overlap this request's planned window. */
export function findConflicts(all: AmbulanceRequest[], req: AmbulanceRequest, hours: number): AmbulanceRequest[] {
  const end = endTime(req.time, hours);
  return all.filter(
    (r) =>
      r.id !== req.id &&
      r.date === req.date &&
      ACTIVE_STATUSES.includes(r.status) &&
      overlaps(req.time, end, r.time, endTime(r.time, r.durationHours ?? DEFAULT_DURATION[r.type])),
  );
}

/** Current local time as HH:mm. */
export function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** YYYY-MM-DD for today + n days (local time). */
export function addDaysISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

/** Sort: emergency first, then by date + time. */
export function sortRequests(list: AmbulanceRequest[]): AmbulanceRequest[] {
  return [...list].sort((a, b) => {
    if (a.type !== b.type) return a.type === "emergency" ? -1 : 1;
    return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
  });
}
