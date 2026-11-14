"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * The barangay raffle. One entry per verified resident, up to the cutoff; the Developer draws in the app.
 * - settings/raffle         : the Developer's setup (dates and prize)
 * - raffleEntries/{uid}     : one entry per person (private: owner and Developer)
 * - raffleResult/current    : the full draw with the reserves (Developer only)
 * - rafflePublic/current    : what everyone sees (first name and initial, purok, entry code, no phone)
 */
export interface RaffleConfig {
  enabled: boolean;
  startAt?: Timestamp;
  cutoffAt?: Timestamp;
  drawAt?: Timestamp;
  /** One prize per winner, in order (1st prize first). The number of prizes is the number of winners. */
  prizes?: string[];
  /** Older single-prize field; used when `prizes` is missing. */
  prize?: string;
}

export interface PublicWinner {
  /** "Rosa M." */
  label: string;
  purok: string;
  code: string;
  prize: string;
}

export interface RafflePublic {
  winners: PublicWinner[];
  total: number;
  /** Reserves not used yet. */
  reservesLeft: number;
  drawnAt?: Timestamp;
}

/** The prizes to draw for (at least one entry only if something was set). */
export function prizeList(c: RaffleConfig | null): string[] {
  if (!c) return [];
  const list = (c.prizes ?? []).map((p) => p.trim()).filter(Boolean);
  if (list.length) return list;
  return c.prize?.trim() ? [c.prize.trim()] : [];
}

export interface RaffleEntry {
  uid: string;
  code: string;
  name: string;
  purok: string;
  createdAt?: Timestamp;
}

export const MAX_RESERVES = 5;
export const MAX_WINNERS = 20;

/** The raffle starts here unless the Developer sets another date. */
export const DEFAULT_START_ISO = "2026-12-28T00:00:00+08:00";

export type RafflePhase = "off" | "soon" | "open" | "closed" | "done";

export function raffleReady(c: RaffleConfig | null): c is RaffleConfig & { startAt: Timestamp; cutoffAt: Timestamp; drawAt: Timestamp } {
  return !!c && c.enabled && !!c.startAt && !!c.cutoffAt && !!c.drawAt;
}

export function phaseOf(c: RaffleConfig | null, pub: RafflePublic | null, now: number): RafflePhase {
  if (pub) return "done";
  if (!raffleReady(c)) return "off";
  if (now < c.startAt.toMillis()) return "soon";
  if (now < c.cutoffAt.toMillis()) return "open";
  return "closed";
}

/* ---- one shared listener for the setup and the public result ---- */
interface Snapshot {
  config: RaffleConfig | null;
  pub: RafflePublic | null;
  loaded: boolean;
}
let current: Snapshot = { config: null, pub: null, loaded: false };
const subscribers = new Set<() => void>();
let started = false;

function emit(patch: Partial<Snapshot>): void {
  current = { ...current, ...patch };
  subscribers.forEach((f) => f());
}

function start(): void {
  if (started) return;
  started = true;
  onSnapshot(
    doc(db, "settings", "raffle"),
    (s) => emit({ config: s.exists() ? ({ enabled: false, ...s.data() } as RaffleConfig) : null, loaded: true }),
    () => emit({ loaded: true }),
  );
  onSnapshot(
    doc(db, "rafflePublic", "current"),
    (s) => emit({ pub: s.exists() ? (s.data() as RafflePublic) : null }),
    () => {},
  );
}

function subscribe(cb: () => void): () => void {
  start();
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

const EMPTY: Snapshot = { config: null, pub: null, loaded: false };

export function useRaffle(): Snapshot {
  return useSyncExternalStore(subscribe, () => current, () => EMPTY);
}

/** The signed-in person's own entry (undefined while loading, null if none). */
export function useMyEntry(uid?: string): RaffleEntry | null | undefined {
  const [entry, setEntry] = useState<RaffleEntry | null | undefined>(undefined);
  useEffect(() => {
    if (!uid) {
      setEntry(null);
      return;
    }
    return onSnapshot(
      doc(db, "raffleEntries", uid),
      (s) => setEntry(s.exists() ? (s.data() as RaffleEntry) : null),
      () => setEntry(null),
    );
  }, [uid]);
  return entry;
}

/** Ticks every second so countdowns stay live. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** 8 characters without look-alikes (no 0/O, 1/I). */
export function newCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** "Rosa Mendoza Cruz" -> "Rosa C." (first name and last initial). */
export function maskName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** Gives the person their entry (the rules check that they are verified, not staff, and before the cutoff). */
export async function claimEntry(uid: string, name: string, purok: string): Promise<void> {
  await setDoc(doc(db, "raffleEntries", uid), { uid, code: newCode(), name, purok, createdAt: serverTimestamp() });
}

/** Countdown parts for display. */
export function countdown(ms: number): { d: number; h: number; m: number; s: number } {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}

export const formatWhen = (ts?: Timestamp): string =>
  ts ? ts.toDate().toLocaleString("fil-PH", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
