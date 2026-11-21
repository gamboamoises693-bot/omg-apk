"use client";

import { useEffect } from "react";
import { collection, doc, getCountFromServer, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import { useAuth } from "@/context/AuthContext";
import { deviceId } from "./presence";

/**
 * Visitor chart for the Kapitan: once a day each phone leaves one small mark (visitMarks/{day}_{who}).
 * "verified" and "unverified" are logged-in accounts, "guest" is a phone that is not logged in.
 * The document id is fixed by who it is for, so a second mark the same day is refused by the rules and nobody is counted twice.
 */
const KEY = "malineng.visitMarks";

/** Today as YYYY-MM-DD in the phone's local time (the Philippines). */
export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function alreadyMarked(day: string, id: string): boolean {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as { day: string; ids: string[] } | null;
    return !!raw && raw.day === day && raw.ids.includes(id);
  } catch {
    return false;
  }
}

function remember(day: string, id: string): void {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as { day: string; ids: string[] } | null;
    const ids = raw && raw.day === day ? raw.ids : [];
    localStorage.setItem(KEY, JSON.stringify({ day, ids: [...ids, id] }));
  } catch {
    /* Storage blocked: the rules still keep it to one mark a day. */
  }
}

/** Leaves today's mark for this phone (renders nothing). */
export function VisitTracker(): null {
  const { user, profile, loading, isVerified } = useAuth();

  useEffect(() => {
    if (!isFirebaseConfigured || loading) return;
    // A logged-in person: wait for the profile, then a few seconds more so the "verified" badge has loaded (otherwise a verified person would count as not verified).
    if (user && !profile) return;
    const timer = setTimeout(() => {
      const day = localDay();
      const kind = !user ? "guest" : isVerified ? "verified" : "unverified";
      const id = `${day}_${user ? user.uid : `g${deviceId()}`}`;
      if (alreadyMarked(day, id)) return;
      setDoc(doc(db, "visitMarks", id), { day, kind, at: serverTimestamp() })
        .then(() => remember(day, id))
        .catch(() => remember(day, id)); // refused = already marked today by this phone
    }, user ? 4000 : 1500);
    return () => clearTimeout(timer);
  }, [loading, user, profile, isVerified]);

  return null;
}

export interface VisitDay {
  day: string;
  verified: number;
  unverified: number;
  guest: number;
}

const memo = new Map<number, { at: number; value: VisitDay[] }>();

/** Counts of the last `days` days (oldest first). One count query per day and kind, remembered for five minutes. */
export async function loadVisits(days: number, force = false): Promise<VisitDay[]> {
  const hit = memo.get(days);
  if (!force && hit && Date.now() - hit.at < 5 * 60_000) return hit.value;
  const list: string[] = [];
  for (let i = days - 1; i >= 0; i--) list.push(localDay(new Date(Date.now() - i * 86_400_000)));
  const count = async (day: string, kind: string) => (await getCountFromServer(query(collection(db, "visitMarks"), where("day", "==", day), where("kind", "==", kind)))).data().count;
  const value = await Promise.all(list.map(async (day) => {
    const [verified, unverified, guest] = await Promise.all([count(day, "verified"), count(day, "unverified"), count(day, "guest")]);
    return { day, verified, unverified, guest };
  }));
  memo.set(days, { at: Date.now(), value });
  return value;
}
