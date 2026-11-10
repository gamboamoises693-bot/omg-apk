import type { Timestamp } from "firebase/firestore";

export type BlotterStatus = "natanggap" | "ipinatawag" | "naayos" | "isinara";

export interface BlotterEvent {
  status: BlotterStatus;
  note: string;
  at: Timestamp;
  by?: string;
}

export interface Blotter {
  id: string;
  caseNo: string;
  complainantId: string;
  complainantName: string;
  purok: string;
  contact: string;
  type: string;
  description: string;
  respondent: string;
  hasPhoto: boolean;
  status: BlotterStatus;
  /** e.g. "2026-11-12T14:00" (local) */
  hearingAt?: string;
  history: BlotterEvent[];
  createdAt?: Timestamp;
}

export const BLOTTER_TYPES = [
  "Ingay / Videoke",
  "Alitan sa lupa / bakod",
  "Utang",
  "Away / Pananakit",
  "Alagang hayop",
  "Basura / Kalinisan",
  "Paninira / Tsismis",
  "Iba pa",
] as const;

export const BLOTTER_STATUS: Record<BlotterStatus, { label: string; badge: "gold" | "blue" | "green" | "gray"; help: string }> = {
  natanggap: { label: "Natanggap", badge: "gold", help: "Natanggap ng Barangay ang reklamo mo." },
  ipinatawag: { label: "Ipinatawag", badge: "blue", help: "Ipinatawag ang dalawang panig para sa pagdinig." },
  naayos: { label: "Naayos", badge: "green", help: "Nagkasundo ang dalawang panig." },
  isinara: { label: "Isinara", badge: "gray", help: "Isinara o in-refer sa ibang ahensya." },
};

export const BLOTTER_FLOW: BlotterStatus[] = ["natanggap", "ipinatawag", "naayos"];

/** BLT-2026-K7Q2 (random part avoids needing a shared counter on the free plan). */
export function newCaseNo(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => chars[b % chars.length]).join("");
  return `BLT-${new Date().getFullYear()}-${rnd}`;
}

export function formatHearing(local: string): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return local;
  return d.toLocaleString("fil-PH", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
