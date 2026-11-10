"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, type Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "@/context/AuthContext";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: string;
  /** Empty = para sa lahat ng purok. */
  puroks: string[];
  createdAt?: Timestamp;
  createdByName?: string;
}

export const ANNOUNCEMENT_CATEGORIES: { name: string; badge: string }[] = [
  { name: "Urgent", badge: "bg-red-600 text-white" },
  { name: "Kalamidad", badge: "bg-orange-100 text-orange-800" },
  { name: "Kalusugan", badge: "bg-brand-light text-brand" },
  { name: "Pulong", badge: "bg-gold-light text-yellow-800" },
  { name: "Abiso", badge: "bg-gray-100 text-gray-700" },
];

export function categoryBadge(category: string): string {
  return ANNOUNCEMENT_CATEGORIES.find((c) => c.name === category)?.badge ?? "bg-gray-100 text-gray-700";
}

export function isUrgent(a: Pick<Announcement, "category">): boolean {
  return a.category === "Urgent" || a.category === "Kalamidad";
}

/** Is this announcement for me? (Guests and people without a purok see everything.) */
export function forMyPurok(a: Announcement, purok: string | undefined): boolean {
  return a.puroks.length === 0 || !purok || a.puroks.includes(purok);
}

/* ---------------- "Seen" marker (per phone, no extra Firestore writes) ---------------- */

const SEEN_KEY = "malineng.pabatidSeenAt";
export const PABATID_SEEN_EVENT = "malineng-pabatid-seen";

export function getSeenAt(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function markAllSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    /* private mode: badge simply stays */
  }
  window.dispatchEvent(new Event(PABATID_SEEN_EVENT));
}

/* ---------------- Live list shared by the bell, the pop-up and the page ---------------- */

let cache: Announcement[] = [];
let ready = false;
let listeners: Array<(a: Announcement[]) => void> = [];
let unsub: (() => void) | null = null;

/** Latest 50 announcements (one shared listener for the whole app). */
export function useAnnouncements(): { all: Announcement[]; loading: boolean } {
  const [all, setAll] = useState<Announcement[]>(cache);
  const [loading, setLoading] = useState(!ready);

  useEffect(() => {
    const l = (a: Announcement[]) => {
      setAll(a);
      setLoading(false);
    };
    listeners.push(l);
    if (!unsub) {
      unsub = onSnapshot(
        query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(50)),
        (snap) => {
          cache = snap.docs.map((d) => {
            const data = d.data() as Omit<Announcement, "id">;
            return { id: d.id, ...data, puroks: Array.isArray(data.puroks) ? data.puroks : [] };
          });
          ready = true;
          listeners.forEach((fn) => fn(cache));
        },
        (err) => {
          console.warn("[pabatid] listener error:", err);
          ready = true;
          listeners.forEach((fn) => fn(cache));
        },
      );
    }
    return () => {
      listeners = listeners.filter((x) => x !== l);
      if (listeners.length === 0 && unsub) {
        unsub();
        unsub = null;
      }
    };
  }, []);

  return { all, loading };
}

/** Announcements for my purok + how many I haven't opened yet. */
export function useMyAnnouncements() {
  const { profile } = useAuth();
  const { all, loading } = useAnnouncements();
  const [seenAt, setSeenAt] = useState(0);

  useEffect(() => {
    const sync = () => setSeenAt(getSeenAt());
    sync();
    window.addEventListener(PABATID_SEEN_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PABATID_SEEN_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const mine = useMemo(() => all.filter((a) => forMyPurok(a, profile?.purok)), [all, profile?.purok]);
  const unread = useMemo(() => mine.filter((a) => (a.createdAt?.toMillis() ?? Date.now()) > seenAt), [mine, seenAt]);
  return { mine, unread, seenAt, loading };
}
