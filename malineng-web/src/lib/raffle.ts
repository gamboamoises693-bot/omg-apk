"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * The barangay raffle. One entry per verified resident, up to the cutoff; the Developer draws in the app.
 * - settings/raffle         : the Developer's setup (dates and prize)
 * - raffleEntries/{uid}     : one entry per person (private: owner and Developer)
 * - raffleRounds/{n}        : the full draw of round n with its reserves (admins only)
 * - rafflePublicRounds/{n}  : what everyone sees of round n (first name and initial, purok, entry code, no phone)
 * - raffleClaims/{n_code}   : a prize handed over (made by an admin after checking the QR and the ID)
 */
export interface RaffleRoundCfg {
  name: string;
  /** "maj" is the last round (the major prize); the others are minor prizes. */
  type: "min" | "maj";
  /** One prize per winner. The number of prizes is the number of winners of this round. */
  prizes: string[];
}

export interface RaffleConfig {
  enabled: boolean;
  startAt?: Timestamp;
  cutoffAt?: Timestamp;
  drawAt?: Timestamp;
  /** The rounds, drawn in order. The last one is the major prize. */
  rounds?: RaffleRoundCfg[];
  /** A person can win only once (default true). */
  onePerPerson?: boolean;
  /** Reserves drawn with each round (0 to 5, default 2). */
  reservesPerRound?: number;
  /** Older single-draw fields; used only when `rounds` is missing. */
  prizes?: string[];
  prize?: string;
}

export interface PublicWinner {
  /** "Rosa M." */
  label: string;
  purok: string;
  code: string;
  prize: string;
}

/** What everyone sees of a drawn round (rafflePublicRounds/{n}). */
export interface PublicRound {
  id: string;
  round: number;
  name: string;
  type: "min" | "maj";
  winners: PublicWinner[];
  total: number;
  reservesLeft: number;
  drawnAt?: Timestamp;
}

/** The rounds to draw (older raffles with a plain prize list count as one major round). */
export function roundsOf(c: RaffleConfig | null): RaffleRoundCfg[] {
  if (!c) return [];
  const list = (c.rounds ?? [])
    .map((r) => ({ name: r.name?.trim() || "Raffle", type: r.type === "maj" ? ("maj" as const) : ("min" as const), prizes: (r.prizes ?? []).map((p) => p.trim()).filter(Boolean) }))
    .filter((r) => r.prizes.length > 0);
  if (list.length) return list.map((r, i) => ({ ...r, type: i === list.length - 1 ? "maj" : "min" }));
  const legacy = (c.prizes ?? []).map((p) => p.trim()).filter(Boolean);
  const prizes = legacy.length ? legacy : c.prize?.trim() ? [c.prize.trim()] : [];
  return prizes.length ? [{ name: "MAJOR PRIZE", type: "maj", prizes }] : [];
}

export const DEFAULT_RESERVES = 2;
export const MAX_ROUNDS = 20;

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

export type RafflePhase = "off" | "soon" | "open" | "closed" | "live" | "done";

export function raffleReady(c: RaffleConfig | null): c is RaffleConfig & { startAt: Timestamp; cutoffAt: Timestamp; drawAt: Timestamp } {
  return !!c && c.enabled && !!c.startAt && !!c.cutoffAt && !!c.drawAt;
}

/** `drawn` = how many rounds have been drawn so far. */
export function phaseOf(c: RaffleConfig | null, drawn: number, now: number): RafflePhase {
  if (!raffleReady(c)) return "off";
  const total = roundsOf(c).length;
  if (total > 0 && drawn >= total) return "done";
  if (drawn > 0) return "live";
  if (now < c.startAt.toMillis()) return "soon";
  if (now < c.cutoffAt.toMillis()) return "open";
  return "closed";
}

/* ---- one shared listener for the setup, the drawn rounds and the claimed prizes ---- */
export interface Claim {
  round: number;
  code: string;
  claimedByName: string;
  claimedAt?: Timestamp;
}

interface Snapshot {
  config: RaffleConfig | null;
  rounds: PublicRound[];
  claims: Record<string, Claim>;
  loaded: boolean;
}
let current: Snapshot = { config: null, rounds: [], claims: {}, loaded: false };
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
    collection(db, "rafflePublicRounds"),
    (snap) => emit({ rounds: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PublicRound).sort((a, b) => a.round - b.round) }),
    () => {},
  );
  onSnapshot(
    collection(db, "raffleClaims"),
    (snap) => emit({ claims: Object.fromEntries(snap.docs.map((d) => [d.id, d.data() as Claim])) }),
    () => {}, // guests cannot read claims: nothing to show
  );
}

function subscribe(cb: () => void): () => void {
  start();
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

const EMPTY: Snapshot = { config: null, rounds: [], claims: {}, loaded: false };

export function useRaffle(): Snapshot {
  return useSyncExternalStore(subscribe, () => current, () => EMPTY);
}

/** The URL in a winner's QR (an admin scans it with the phone camera). */
export const verifyUrl = (round: number, code: string): string => `${typeof window !== "undefined" ? window.location.origin : ""}/raffle/verify/?r=${round}&c=${code}`;

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
