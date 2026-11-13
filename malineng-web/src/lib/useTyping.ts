"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

/** A "typing" mark counts as live for this long after it was written. */
const LIVE_MS = 8_000;
/** While someone keeps typing we refresh the mark at most this often (keeps writes low on the free plan). */
const REFRESH_MS = 4_000;

const typingRef = (room: string, uid: string) => doc(db, "chatRooms", room, "typing", uid);

/**
 * "Nagta-type..." for one chat room.
 * - `pingTyping()` is called on every keystroke; it writes at most once every 4 seconds.
 * - `stopTyping()` removes the mark (message sent, field emptied, left the room).
 * - `typers` holds the first names of OTHER people typing right now.
 * Only listens while the room is open.
 */
export function useTyping(room: string): { typers: string[]; pingTyping: () => void; stopTyping: () => void } {
  const { user, profile } = useAuth();
  const [marks, setMarks] = useState<{ uid: string; name: string; at: number }[]>([]);
  const [, tick] = useState(0);
  const lastWrite = useRef(0);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      collection(db, "chatRooms", room, "typing"),
      (snap) =>
        setMarks(
          snap.docs.map((d) => {
            const v = d.data() as { name?: string; at?: Timestamp };
            return { uid: d.id, name: v.name ?? "", at: v.at?.toMillis() ?? 0 };
          }),
        ),
      () => setMarks([]),
    );
  }, [room, user]);

  // Re-evaluate every 2 seconds so a stale mark disappears even when nothing else changes.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 2_000);
    return () => clearInterval(t);
  }, []);

  const stopTyping = useCallback(() => {
    if (!user) return;
    lastWrite.current = 0;
    deleteDoc(typingRef(room, user.uid)).catch(() => {});
  }, [room, user]);

  const pingTyping = useCallback(() => {
    if (!user || !profile) return;
    if (Date.now() - lastWrite.current < REFRESH_MS) return;
    lastWrite.current = Date.now();
    setDoc(typingRef(room, user.uid), { name: profile.fullName, at: serverTimestamp() }).catch(() => {});
  }, [room, user, profile]);

  // Remove the mark when leaving the room.
  useEffect(() => stopTyping, [stopTyping]);

  const now = Date.now();
  const typers = marks
    .filter((m) => m.uid !== user?.uid && now - m.at < LIVE_MS)
    .map((m) => m.name.split(" ")[0])
    .filter(Boolean);
  return { typers, pingTyping, stopTyping };
}

/** "Ana ay nagta-type...", "Ana at Juan ay nagta-type...", "Ilang tao ay nagta-type..." */
export function typingLabel(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} ay nagta-type`;
  if (names.length === 2) return `${names[0]} at ${names[1]} ay nagta-type`;
  return "Ilang tao ay nagta-type";
}
