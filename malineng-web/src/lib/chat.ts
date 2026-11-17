import { Timestamp } from "firebase/firestore";

export interface ChatMessage {
  id: string;
  text: string;
  /** Compressed JPEG data URL, or "". */
  photo: string;
  authorId: string;
  authorName: string;
  /** "Kapitan", "Secretary", "Super Admin"... or "" for residents. Enforced by firestore.rules. */
  authorRole: string;
  createdAt?: Timestamp;
  /** Who reacted: uid → emoji (one reaction per person). */
  reactions?: Record<string, string>;
}

/** The reactions a person can give to a chat message (the database rules accept only these). */
export const CHAT_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export interface ChatSettings {
  enabled: boolean;
  photos: boolean;
}

export const ROOM_ALL = "all";
/** Messages older than this are hidden and cleaned up by the officers' Chat Moderation page. */
export const CHAT_DAYS = 7;
export const OWN_DELETE_MINUTES = 5;
export const MAX_TEXT = 500;
export const MESSAGE_LIMIT = 60;

/** Private staff rooms. Access is enforced by firestore.rules (canReadRoom). */
export const ROOM_STAFF_ADMIN = "staff-admin";
export const ROOM_STAFF_OFFICIALS = "staff-officials";

/** Direct chat with the Developer: every person has one private room, "dev-<uid>". Only that person and the Developer can read it. */
export const DEV_PREFIX = "dev-";
export const devRoomOf = (uid: string): string => `${DEV_PREFIX}${uid}`;
export const isDevRoom = (room: string): boolean => room.startsWith(DEV_PREFIX) && room.length > DEV_PREFIX.length;
export const devRoomUid = (room: string): string => room.slice(DEV_PREFIX.length);

/**
 * Help with setting up an account: every person has one private room, "help-<uid>". Only that person and the admins
 * (Kapitan, Secretary... and the Developer) can read it. It needs a login only, not verification.
 */
export const HELP_PREFIX = "help-";
export const helpRoomOf = (uid: string): string => `${HELP_PREFIX}${uid}`;
export const isHelpRoom = (room: string): boolean => room.startsWith(HELP_PREFIX) && room.length > HELP_PREFIX.length;
export const helpRoomUid = (room: string): string => room.slice(HELP_PREFIX.length);

/** One line per person who asked for help with their account (the admins' help inbox), kept in helpChats/{uid}. */
export interface HelpChat {
  id: string;
  uid: string;
  name: string;
  lastText: string;
  lastAt?: Timestamp;
  /** Who wrote last: "user" (waiting for an answer) or "staff". */
  lastFrom: "user" | "staff";
}

/** One line per person who wrote to the Developer (the Developer's inbox), kept in devChats/{uid}. */
export interface DevChat {
  id: string;
  uid: string;
  name: string;
  lastText: string;
  lastAt?: Timestamp;
  /** Who wrote last: "user" (needs an answer) or "dev". */
  lastFrom: "user" | "dev";
}

export function isStaffRoom(room: string): boolean {
  return room === ROOM_STAFF_ADMIN || room === ROOM_STAFF_OFFICIALS;
}

/* ---- Video call (Jitsi Meet): a call is a chat message holding a random room name ---- */
const CALL_RE = /^\[\[call:(Malineng-[A-Za-z0-9]{16})\]\]$/;

/** Returns the Jitsi room name when the text is a call message, else null. */
export function parseCall(text: string): string | null {
  return CALL_RE.exec(text)?.[1] ?? null;
}

/** A new unguessable call message ("[[call:Malineng-xxxxxxxxxxxxxxxx]]"). */
export function newCallMessage(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `[[call:Malineng-${id}]]`;
}

export function callUrl(callRoom: string, displayName: string): string {
  return `https://meet.jit.si/${callRoom}#userInfo.displayName=${encodeURIComponent(JSON.stringify(displayName))}`;
}

export function roomTitle(room: string): string {
  if (isDevRoom(room)) return "Chat sa Developer";
  if (isHelpRoom(room)) return "Chat sa Admin ng Barangay";
  if (room === ROOM_STAFF_ADMIN) return "GC ng mga Admin";
  if (room === ROOM_STAFF_OFFICIALS) return "GC ng mga Opisyal";
  return room === ROOM_ALL ? "Buong Barangay" : room;
}

export function cutoffTimestamp(): Timestamp {
  return Timestamp.fromMillis(Date.now() - CHAT_DAYS * 24 * 60 * 60 * 1000);
}

export const MUTE_OPTIONS = [
  { label: "1 oras", ms: 60 * 60 * 1000 },
  { label: "1 araw", ms: 24 * 60 * 60 * 1000 },
  { label: "7 araw", ms: 7 * 24 * 60 * 60 * 1000 },
] as const;

export const REPORT_REASONS = ["Bastos na salita", "Spam o patalastas", "Maling impormasyon", "Panliligalig", "Iba pa"] as const;

/* ---- "Bago" marker: when this person last opened a room (kept on the device) ---- */
const readKey = (room: string) => `malineng-chat-read-${room}`;
export function getLastRead(room: string): number {
  try {
    return Number(localStorage.getItem(readKey(room)) ?? 0) || 0;
  } catch {
    return 0;
  }
}
export function setLastRead(room: string, millis: number): void {
  try {
    localStorage.setItem(readKey(room), String(millis));
  } catch {
    // Storage blocked: the "Bago" dot just shows again.
  }
  // Tell the bottom-nav badge (same tab) that a room was read.
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHAT_READ_EVENT));
}

export const CHAT_READ_EVENT = "malineng-chat-read";

export function timeLabel(ts?: Timestamp | null): string {
  if (!ts) return "";
  return ts.toDate().toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
}

export function dayLabel(ts?: Timestamp | null): string {
  if (!ts) return "Ngayon";
  const d = ts.toDate();
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Ngayon";
  if (d.toDateString() === yesterday.toDateString()) return "Kahapon";
  return d.toLocaleDateString("fil-PH", { month: "short", day: "numeric" });
}
