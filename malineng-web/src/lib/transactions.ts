import { Timestamp, collection, getDocs, limit, query, where, type DocumentData } from "firebase/firestore";
import { db } from "./firebase";
import { REQUEST_STATUS_LABEL } from "./ambulance";
import { APPOINTMENT_STATUS_LABEL } from "./constants";
import { BLOTTER_STATUS } from "./blotter";
import { DONATION_STATUS_LABEL } from "./raffleDonations";

/**
 * Every transaction of the barangay in one list, for the Kapitan's dashboard.
 * Each source collection is read once with a single-field time range (no index needed)
 * and normalised into the same small shape.
 */
export type TxnStatus = "pending" | "done" | "rejected";

export interface TxnTrail {
  name: string;
  role: string;
  text: string;
  /** Milliseconds. */
  at: number;
}

export interface Txn {
  /** Unique across sources. */
  key: string;
  /** Service shown in the lists and the chart. */
  service: string;
  /** Person the transaction is for. */
  name: string;
  /** One line of detail, e.g. the kind of clearance or the medicine. */
  detail: string;
  /** Normalised status for the counters. */
  status: TxnStatus;
  /** The status as the section itself words it. */
  statusLabel: string;
  /** Milliseconds. */
  at: number;
  ref: string;
  purok: string;
  contact: string;
  /** Last person who acted on it, when the data says. */
  handledBy: string;
  trail: TxnTrail[];
  /** Extra facts for the executive view (ambulance trips only). */
  meta?: { kind?: string; reason?: string; /** minutes from request to "papunta na" */ respMin?: number };
  /** Admin section (src/app/admin/page.tsx) where it is handled; empty when it is handled elsewhere. */
  tab: string;
  urgent: boolean;
}

export const STATUS_WORD: Record<TxnStatus, string> = { pending: "Naghihintay", done: "Tapos na", rejected: "Hindi natuloy" };

/** Most documents read per collection per period: keeps one dashboard visit well inside the free daily reads. */
export const MAX_PER_SOURCE = 800;

export type Period = "today" | "week" | "month" | "year";
export const PERIOD_LABEL: Record<Period, string> = { today: "Ngayon", week: "7 araw", month: "Buwan", year: "Taon" };

export interface Range {
  start: number;
  end: number;
  /** The same length right before `start`, to compare against. */
  prevStart: number;
}

const DAY = 86_400_000;

/** Start/end (ms) of the chosen period in the phone's local time, plus the previous period of equal size. */
export function rangeFor(period: Period, now = new Date()): Range {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = startOfDay + DAY;
  if (period === "today") return { start: startOfDay, end, prevStart: startOfDay - DAY };
  if (period === "week") return { start: end - 7 * DAY, end, prevStart: end - 14 * DAY };
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    return { start, end, prevStart };
  }
  const start = new Date(now.getFullYear(), 0, 1).getTime();
  return { start, end, prevStart: new Date(now.getFullYear() - 1, 0, 1).getTime() };
}

export function periodTitle(period: Period, range: Range): string {
  const f = (ms: number) => new Date(ms).toLocaleDateString("fil-PH", { month: "short", day: "numeric", year: "numeric" });
  if (period === "today") return f(range.start);
  return `${f(range.start)} – ${f(range.end - 1)}`;
}

/* ---------------- Reading each source ---------------- */

const ms = (t: unknown): number => (t instanceof Timestamp ? t.toMillis() : 0);

function lastTrail(trail: TxnTrail[]): string {
  const last = trail[trail.length - 1];
  return last ? `${last.name}${last.role ? ` (${last.role})` : ""}` : "";
}

function readTrail(raw: unknown): TxnTrail[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e: DocumentData) => ({
      name: String(e?.name ?? ""),
      role: String(e?.role ?? ""),
      text: String(e?.note ?? "") || trailStepWord(String(e?.step ?? "")),
      at: Date.parse(String(e?.at ?? "")) || 0,
    }))
    .filter((e) => e.name);
}

function trailStepWord(step: string): string {
  const words: Record<string, string> = {
    endorse: "Nag-endorse",
    agree: "Sumang-ayon",
    release: "Inaprubahan",
    reject: "Tinanggihan",
    return: "Ibinalik",
    fast: "Mabilis na aprubal",
    override: "Developer override",
    handback: "Ibinalik sa residente",
    accept: "Tinanggap",
    resident: "Residente",
  };
  return words[step] ?? "Kumilos";
}

type Reader = (d: DocumentData, id: string) => Txn | null;

const SOURCES: { name: string; field: string; read: Reader }[] = [
  {
    name: "appointments",
    field: "createdAt",
    read: (d, id) => {
      const status = String(d.status ?? "natanggap");
      const trail = readTrail(d.trail);
      return {
        key: `appointments/${id}`,
        service: "Appointment",
        name: String(d.fullName ?? "—"),
        detail: String(d.service ?? "—"),
        status: status === "ready" ? "done" : "pending",
        statusLabel: (APPOINTMENT_STATUS_LABEL as Record<string, string>)[status]?.split(" —")[0] ?? status,
        at: ms(d.createdAt),
        ref: `APT-${id.slice(0, 6).toUpperCase()}`,
        purok: "",
        contact: String(d.contact ?? ""),
        handledBy: lastTrail(trail),
        trail,
        tab: "appointments",
        urgent: false,
      };
    },
  },
  {
    name: "ambulanceRequests",
    field: "createdAt",
    read: (d, id) => {
      const status = String(d.status ?? "pending");
      const trail = readTrail(d.trail);
      return {
        key: `ambulanceRequests/${id}`,
        service: "Ambulansya",
        name: String(d.patientName ?? "—"),
        detail: `${d.type === "emergency" ? "Emergency" : "Naka-schedule"}${d.reason ? ` · ${d.reason}` : ""}`,
        status: status === "done" ? "done" : status === "rejected" || status === "cancelled" ? "rejected" : "pending",
        statusLabel: (REQUEST_STATUS_LABEL as Record<string, string>)[status] ?? status,
        at: ms(d.createdAt),
        ref: `AMB-${id.slice(0, 6).toUpperCase()}`,
        purok: String(d.purok ?? ""),
        contact: String(d.contact ?? ""),
        handledBy: lastTrail(trail) || String(d.doneBy ?? ""),
        trail,
        meta: {
          kind: String(d.type ?? ""),
          reason: String(d.reason ?? ""),
          // How long the Barangay took to send the ambulance (only when the request has both times).
          respMin: d.enrouteAt instanceof Timestamp && d.createdAt instanceof Timestamp ? Math.max(0, Math.round((d.enrouteAt.toMillis() - d.createdAt.toMillis()) / 60000)) : undefined,
        },
        tab: "ambulansya",
        urgent: d.type === "emergency" || d.urgent === true,
      };
    },
  },
  {
    name: "blotters",
    field: "createdAt",
    read: (d, id) => {
      const status = String(d.status ?? "natanggap");
      const history: TxnTrail[] = Array.isArray(d.history)
        ? d.history.map((h: DocumentData) => ({ name: String(h?.by ?? "Barangay"), role: "", text: String(h?.note ?? "") || (BLOTTER_STATUS as Record<string, { label: string }>)[String(h?.status)]?.label || "", at: ms(h?.at) }))
        : [];
      return {
        key: `blotters/${id}`,
        service: "Reklamo",
        name: String(d.complainantName ?? "—"),
        detail: String(d.type ?? "Reklamo"),
        status: status === "naayos" || status === "isinara" ? "done" : "pending",
        statusLabel: (BLOTTER_STATUS as Record<string, { label: string }>)[status]?.label ?? status,
        at: ms(d.createdAt),
        ref: String(d.caseNo ?? id.slice(0, 8)),
        purok: String(d.purok ?? ""),
        contact: String(d.contact ?? ""),
        handledBy: history.length > 1 ? history[history.length - 1].name : "",
        trail: history.filter((h) => h.name),
        tab: "blotter",
        urgent: false,
      };
    },
  },
  {
    name: "borrowRequests",
    field: "createdAt",
    read: (d, id) => {
      const status = String(d.status ?? "pending");
      const trail = readTrail(d.trail);
      const lines = Array.isArray(d.items) ? d.items.map((l: DocumentData) => `${l?.qty ?? 1} ${l?.name ?? ""}`.trim()).join(", ") : "";
      const label: Record<string, string> = { pending: "Naghihintay", approved: "Inaprubahan", borrowed: "Hiniram na", returned: "Naibalik na", rejected: "Hindi naaprubahan", cancelled: "Na-cancel" };
      return {
        key: `borrowRequests/${id}`,
        service: "Hiraman",
        name: String(d.userName ?? "—"),
        detail: lines || "Hiram ng gamit",
        status: status === "returned" ? "done" : status === "rejected" || status === "cancelled" ? "rejected" : "pending",
        statusLabel: label[status] ?? status,
        at: ms(d.createdAt),
        ref: `HRM-${id.slice(0, 6).toUpperCase()}`,
        purok: String(d.purok ?? ""),
        contact: String(d.contact ?? ""),
        handledBy: lastTrail(trail) || String(d.decidedByName ?? ""),
        trail,
        tab: "hiraman",
        urgent: d.urgent === true,
      };
    },
  },
  {
    name: "raffleDonations",
    field: "createdAt",
    read: (d, id) => {
      const status = String(d.status ?? "new");
      return {
        key: `raffleDonations/${id}`,
        service: "Raffle donasyon",
        name: d.anon ? `${d.name ?? "Donor"} (anonymous)` : String(d.name ?? "—"),
        detail: String(d.what ?? "Donasyon"),
        status: status === "received" ? "done" : status === "declined" ? "rejected" : "pending",
        statusLabel: (DONATION_STATUS_LABEL as Record<string, string>)[status] ?? status,
        at: ms(d.createdAt),
        ref: String(d.receiptNo ?? `DON-${id.slice(0, 6).toUpperCase()}`),
        purok: "",
        contact: String(d.contact ?? ""),
        handledBy: String(d.receivedByName ?? ""),
        trail: [],
        tab: "rafflepledge",
        urgent: false,
      };
    },
  },
  {
    name: "medicineLogs",
    field: "createdAt",
    read: (d, id) => {
      // Only medicine handed to a resident is a transaction; restocking and disposal are the BHW's own stock work.
      if (d.type !== "dispense") return null;
      const items = Array.isArray(d.items) ? d.items.map((i: DocumentData) => `${i?.qty ?? 1} ${i?.name ?? ""}`.trim()).join(", ") : "";
      return {
        key: `medicineLogs/${id}`,
        service: "Botika",
        name: String(d.residentName ?? "—"),
        detail: items || "Gamot",
        status: "done",
        statusLabel: "Naibigay na",
        at: ms(d.createdAt),
        ref: `BTK-${id.slice(0, 6).toUpperCase()}`,
        purok: String(d.purok ?? ""),
        contact: "",
        handledBy: String(d.byName ?? ""),
        trail: [],
        // Handed out from the Botika page (BHW), not from an admin tab.
        tab: "",
        urgent: false,
      };
    },
  },
];

export interface Loaded {
  txns: Txn[];
  /** Sources that hit the read cap, so the numbers may be a little low. */
  truncated: string[];
  /** Sources that could not be read (for example, no permission). */
  failed: string[];
}

const cache = new Map<string, { at: number; value: Loaded }>();
const CACHE_MS = 2 * 60_000;

/** Reads all sources for [from, end). `force` skips the two-minute cache. */
export async function loadTransactions(from: number, end: number, force = false): Promise<Loaded> {
  const key = `${from}-${end}`;
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const truncated: string[] = [];
  const failed: string[] = [];
  const batches = await Promise.all(
    SOURCES.map(async (s) => {
      try {
        const snap = await getDocs(
          query(collection(db, s.name), where(s.field, ">=", Timestamp.fromMillis(from)), where(s.field, "<", Timestamp.fromMillis(end)), limit(MAX_PER_SOURCE)),
        );
        if (snap.size >= MAX_PER_SOURCE) truncated.push(s.name);
        return snap.docs.map((d) => s.read(d.data(), d.id)).filter((t): t is Txn => !!t && t.at > 0);
      } catch (err) {
        console.warn(`[transactions] ${s.name}:`, err);
        failed.push(s.name);
        return [];
      }
    }),
  );
  const value: Loaded = { txns: batches.flat().sort((a, b) => b.at - a.at), truncated, failed };
  cache.set(key, { at: Date.now(), value });
  return value;
}

/* ---------------- Numbers for the dashboard and the PDF ---------------- */

export interface Summary {
  total: number;
  pending: number;
  done: number;
  rejected: number;
  /** Percent change of the total against the previous period, or null when there was nothing before. */
  change: number | null;
  byService: { service: string; count: number; pending: number }[];
  byDay: { day: string; count: number }[];
}

export function summarize(current: Txn[], previous: Txn[]): Summary {
  const count = (list: Txn[], s: TxnStatus) => list.filter((t) => t.status === s).length;
  const services = new Map<string, { count: number; pending: number }>();
  current.forEach((t) => {
    const e = services.get(t.service) ?? { count: 0, pending: 0 };
    e.count += 1;
    if (t.status === "pending") e.pending += 1;
    services.set(t.service, e);
  });
  const days = new Map<string, number>();
  current.forEach((t) => {
    const d = new Date(t.at);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.set(k, (days.get(k) ?? 0) + 1);
  });
  return {
    total: current.length,
    pending: count(current, "pending"),
    done: count(current, "done"),
    rejected: count(current, "rejected"),
    change: previous.length ? Math.round(((current.length - previous.length) / previous.length) * 100) : null,
    byService: [...services.entries()].map(([service, v]) => ({ service, ...v })).sort((a, b) => b.count - a.count),
    byDay: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, c]) => ({ day, count: c })),
  };
}

/** Splits the loaded list into this period and the one before it. */
export function splitPeriods(all: Txn[], range: Range): { current: Txn[]; previous: Txn[] } {
  return { current: all.filter((t) => t.at >= range.start && t.at < range.end), previous: all.filter((t) => t.at >= range.prevStart && t.at < range.start) };
}

export function formatWhen(at: number): string {
  return new Date(at).toLocaleString("fil-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function dayHeading(at: number): string {
  const d = new Date(at);
  const today = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const yesterday = new Date(today.getTime() - DAY);
  const base = d.toLocaleDateString("fil-PH", { month: "short", day: "numeric" });
  if (same(d, today)) return `Ngayon · ${base}`;
  if (same(d, yesterday)) return `Kahapon · ${base}`;
  return d.toLocaleDateString("fil-PH", { weekday: "long", month: "short", day: "numeric" });
}
