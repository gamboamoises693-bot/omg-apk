import { Timestamp, doc, increment, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

/* ---------------- Types ---------------- */

export interface BorrowItem {
  id: string;
  name: string;
  /** Small square data URL ("" = no photo). */
  photo: string;
  total: number;
  maxPerBorrow: number;
  /** 0 = libre. */
  fee: number;
  note: string;
  hidden: boolean;
  /** Units that came back broken and are out of use until repaired (they stay inside `total`). */
  damaged?: number;
  createdAt?: Timestamp;
}

export interface BorrowLine {
  itemId: string;
  name: string;
  qty: number;
}

/** What came back for one line of a request. good + damaged + lost = the quantity borrowed. */
export interface ReturnLine {
  itemId: string;
  name: string;
  good: number;
  damaged: number;
  lost: number;
}

export type FeeStatus = "unpaid" | "paid" | "waived";

export type BorrowStatus = "pending" | "approved" | "borrowed" | "returned" | "rejected" | "cancelled";

export interface BorrowRequest {
  id: string;
  userId: string;
  userName: string;
  purok: string;
  contact: string;
  items: BorrowLine[];
  itemIds: string[];
  start: Timestamp;
  end: Timestamp;
  purpose: string;
  note: string;
  status: BorrowStatus;
  rejectReason?: string;
  decidedByName?: string;
  returnNote?: string;
  /** Set when the items were returned: how many came back fine, damaged or lost. */
  returnReport?: ReturnLine[];
  /** Charge for damaged or lost items (₱), and whether it was paid. */
  damageFee?: number;
  feeStatus?: FeeStatus;
  createdAt?: Timestamp;
  borrowedAt?: Timestamp;
  returnedAt?: Timestamp;
}

/** Public reservation (no personal info): borrowBookings/{requestId}. */
export interface BorrowBooking {
  id: string;
  items: { itemId: string; qty: number }[];
  itemIds: string[];
  start: Timestamp;
  end: Timestamp;
  /** "borrowed" = already picked up; still counts until returned, even after `end`. */
  status: "approved" | "borrowed";
}

/* ---------------- Constants ---------------- */

export const BORROW_PURPOSES = ["Lamay / Burol", "Birthday / Handaan", "Kasal / Binyag", "Pulong ng Purok", "Liga / Palaro", "Simbahan / Relihiyon", "Iba pa"] as const;
export const BORROW_REJECT_REASONS = [
  "Hindi available sa petsang iyan",
  "Ginagamit ng Barangay sa petsang iyan",
  "Kulang ang detalye. Tumawag sa Barangay Hall.",
  "May hindi pa naibabalik na gamit",
] as const;

export const BORROW_STATUS_LABEL: Record<BorrowStatus, string> = {
  pending: "Naghihintay ng approval",
  approved: "Aprubado, kunin sa Barangay Hall",
  borrowed: "Nakahiram",
  returned: "Naibalik na",
  rejected: "Hindi naaprubahan",
  cancelled: "Kinansela",
};

/* ---------------- Availability ---------------- */

export function ms(ts?: Timestamp | null): number {
  return ts?.toMillis?.() ?? 0;
}

/**
 * Bookings that hold an item during [start, end). A picked-up ("borrowed") booking
 * keeps holding the item past its end date until it is actually returned.
 */
function overlaps(b: BorrowBooking, start: number, end: number, now: number): boolean {
  const bEnd = b.status === "borrowed" ? Math.max(ms(b.end), now) : ms(b.end);
  return ms(b.start) < end && bEnd > start;
}

/** How many of an item are free for the whole range (worst moment counts). */
export function availableQty(item: BorrowItem, bookings: BorrowBooking[], start: number, end: number, now = Date.now(), ignoreBookingId = ""): number {
  const relevant = bookings.filter((b) => b.id !== ignoreBookingId && b.itemIds.includes(item.id) && overlaps(b, start, end, now));
  // Peak usage: check at the start of the range and at every booking start inside it.
  const points = [start, ...relevant.map((b) => ms(b.start)).filter((t) => t > start && t < end)];
  let peak = 0;
  for (const t of points) {
    const used = relevant
      .filter((b) => overlaps(b, t, t + 1, now))
      .reduce((sum, b) => sum + (b.items.find((i) => i.itemId === item.id)?.qty ?? 0), 0);
    peak = Math.max(peak, used);
  }
  // Broken units are out of use until the Barangay repairs or discards them.
  return Math.max(0, item.total - (item.damaged ?? 0) - peak);
}

/** When the next unit of a fully-booked item comes back (earliest end among bookings holding it now). */
export function nextReturn(item: BorrowItem, bookings: BorrowBooking[], now = Date.now()): number | null {
  const ends = bookings.filter((b) => b.itemIds.includes(item.id) && overlaps(b, now, now + 1, now)).map((b) => ms(b.end));
  return ends.length ? Math.min(...ends) : null;
}

/** Reservations that start later (approved, not picked up yet): shown on the card so a booked item is not a surprise. */
export function upcomingReservations(item: BorrowItem, bookings: BorrowBooking[], now = Date.now()): { start: number; end: number; qty: number }[] {
  return bookings
    .filter((b) => b.itemIds.includes(item.id) && b.status === "approved" && ms(b.start) > now)
    .map((b) => ({ start: ms(b.start), end: ms(b.end), qty: b.items.find((i) => i.itemId === item.id)?.qty ?? 0 }))
    .sort((a, b) => a.start - b.start);
}

export function reportSummary(report?: ReturnLine[]): string {
  if (!report) return "";
  const parts: string[] = [];
  for (const l of report) {
    if (l.damaged > 0) parts.push(`${l.damaged} ${l.name} na may sira`);
    if (l.lost > 0) parts.push(`${l.lost} ${l.name} na nawala`);
  }
  return parts.join(", ");
}

export function isLate(r: Pick<BorrowRequest, "status" | "end">, now = Date.now()): boolean {
  return (r.status === "approved" || r.status === "borrowed") && ms(r.end) < now;
}

/* ---------------- Formatting ---------------- */

export function formatWhen(ts: Timestamp | number): string {
  const d = typeof ts === "number" ? new Date(ts) : ts.toDate();
  return d.toLocaleString("fil-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function feeLabel(fee: number): string {
  return fee > 0 ? `₱${fee.toLocaleString("en-PH")} kada hiram` : "Libre";
}

export function linesText(items: BorrowLine[]): string {
  return items.map((i) => `${i.name} × ${i.qty}`).join(", ");
}

/** datetime-local value (local time) <-> millis */
export function toLocalInput(msValue: number): string {
  const d = new Date(msValue);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(msValue - off).toISOString().slice(0, 16);
}

/* ---------------- Admin actions (request + public booking change together) ---------------- */

interface Actor {
  uid: string;
  name: string;
}

export async function approveRequest(r: BorrowRequest, actor: Actor): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "borrowRequests", r.id), { status: "approved", decidedBy: actor.uid, decidedByName: actor.name, decidedAt: serverTimestamp() });
  batch.set(doc(db, "borrowBookings", r.id), {
    items: r.items.map((i) => ({ itemId: i.itemId, qty: i.qty })),
    itemIds: r.itemIds,
    start: r.start,
    end: r.end,
    status: "approved",
  });
  await batch.commit();
}

export async function markBorrowed(r: BorrowRequest): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "borrowRequests", r.id), { status: "borrowed", borrowedAt: serverTimestamp() });
  batch.update(doc(db, "borrowBookings", r.id), { status: "borrowed" });
  await batch.commit();
}

/**
 * Return a request with what really came back. Damaged units stay in the item's stock but are marked out of use
 * (`damaged`), lost units leave the stock, and a charge can be recorded for the borrower.
 */
export async function markReturned(r: BorrowRequest, report: ReturnLine[], returnNote: string, damageFee: number, actor: Actor): Promise<void> {
  const batch = writeBatch(db);
  const fee = Math.max(0, Math.round(damageFee));
  batch.update(doc(db, "borrowRequests", r.id), {
    status: "returned",
    returnedAt: serverTimestamp(),
    returnNote: returnNote.slice(0, 300),
    returnedToName: actor.name,
    returnReport: report,
    damageFee: fee,
    feeStatus: fee > 0 ? "unpaid" : "waived",
  });
  batch.delete(doc(db, "borrowBookings", r.id));
  for (const l of report) {
    if (l.damaged > 0 || l.lost > 0) {
      batch.update(doc(db, "borrowItems", l.itemId), { total: increment(-l.lost), damaged: increment(l.damaged) });
    }
  }
  await batch.commit();
}

/** A damaged unit was repaired (back in use) or discarded (leaves the stock). */
export async function settleDamaged(item: BorrowItem, qty: number, action: "repair" | "discard"): Promise<void> {
  const n = Math.min(Math.max(1, Math.floor(qty)), item.damaged ?? 0);
  const batch = writeBatch(db);
  batch.update(doc(db, "borrowItems", item.id), action === "repair" ? { damaged: increment(-n) } : { damaged: increment(-n), total: increment(-n) });
  await batch.commit();
}

export async function setFeeStatus(r: BorrowRequest, status: FeeStatus): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "borrowRequests", r.id), { feeStatus: status });
  await batch.commit();
}

export async function rejectRequest(r: BorrowRequest, reason: string, actor: Actor): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "borrowRequests", r.id), { status: "rejected", rejectReason: reason, decidedBy: actor.uid, decidedByName: actor.name, decidedAt: serverTimestamp() });
  // Also frees the dates if an approved request is being cancelled by the barangay.
  batch.delete(doc(db, "borrowBookings", r.id));
  await batch.commit();
}
