"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, limit, onSnapshot, query, serverTimestamp, setDoc, Timestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { ROOM_ALL, isDevRoom, isHelpRoom, isStaffRoom, type ChatMessage } from "@/lib/chat";

/** One "seen" mark per person per room is refreshed at most this often (keeps writes low on the free plan). */
const MIN_WRITE_MS = 10_000;

/**
 * "Nakita ni ..." for a chat room.
 * - Writes ONE small mark (chatRooms/{room}/reads/{uid}) when this person opens the room and sees a newer message from someone else.
 * - Listens only to the marks made after the person's own newest message (so the read cost is the number of readers).
 * - Nothing is written or shown in the big barangay room, or when the person turned "seen" off in Account.
 * Returns the label to show under the person's newest message ("" when there is nothing to show).
 */
export function useSeen(room: string, messages: ChatMessage[]): { label: string; messageId: string } {
  const { user, profile } = useAuth();
  const enabled = !!user && !!profile && room !== ROOM_ALL && profile.hideSeen !== true;
  const uid = user?.uid;

  // Newest message written by someone else, and newest message written by me (server time known).
  const newestOther = useMemo(() => [...messages].reverse().find((m) => m.authorId !== uid && m.createdAt)?.createdAt?.toMillis() ?? 0, [messages, uid]);
  const mineLast = useMemo(() => [...messages].reverse().find((m) => m.authorId === uid && m.createdAt), [messages, uid]);
  const mineLastMs = mineLast?.createdAt?.toMillis() ?? 0;

  // Mark what I have seen.
  const wrote = useRef({ for: 0, at: 0 });
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const on = () => setVisible(document.visibilityState === "visible");
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  useEffect(() => {
    if (!enabled || !visible || !uid || !profile || !newestOther || wrote.current.for >= newestOther) return;
    const wait = Math.max(0, wrote.current.at + MIN_WRITE_MS - Date.now());
    const timer = setTimeout(() => {
      wrote.current = { for: newestOther, at: Date.now() };
      setDoc(doc(db, "chatRooms", room, "reads", uid), { name: profile.fullName, at: serverTimestamp() }).catch(() => {});
    }, wait);
    return () => clearTimeout(timer);
  }, [enabled, visible, uid, profile, newestOther, room]);

  // Who has seen my newest message.
  const [readers, setReaders] = useState<{ uid: string; name: string }[]>([]);
  useEffect(() => {
    if (!enabled || !mineLastMs) {
      setReaders([]);
      return;
    }
    const q = query(collection(db, "chatRooms", room, "reads"), where("at", ">=", Timestamp.fromMillis(mineLastMs)), limit(100));
    return onSnapshot(
      q,
      (snap) => setReaders(snap.docs.filter((d) => d.id !== uid).map((d) => ({ uid: d.id, name: String(d.data().name ?? "") }))),
      () => setReaders([]),
    );
  }, [enabled, mineLastMs, room, uid]);

  if (!mineLast || readers.length === 0) return { label: "", messageId: "" };
  let label: string;
  if (isDevRoom(room)) label = "Nakita";
  else if (isStaffRoom(room) || isHelpRoom(room)) {
    const names = readers.map((r) => r.name.split(" ")[0]).filter(Boolean);
    label = `Nakita ni ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` +${names.length - 3}` : ""}`;
  } else label = `Nakita ng ${readers.length}`;
  return { label, messageId: mineLast.id };
}
