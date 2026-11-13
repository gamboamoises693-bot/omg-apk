"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { isFresh, notifyNew } from "@/lib/notifyPrefs";
import { CHAT_READ_EVENT, ROOM_ALL, ROOM_STAFF_ADMIN, ROOM_STAFF_OFFICIALS, cutoffTimestamp, getLastRead, isStaffRoom, parseCall, roomTitle } from "@/lib/chat";

/**
 * Number of chat rooms with a message the person has not opened yet (for the bottom-nav badge).
 * Free-plan friendly: one listener per readable room, each limited to the single newest message,
 * and nothing is listened to for guests or people who cannot read the chat.
 * Staff watch the barangay room, their own Purok (if any) and the private staff rooms they belong to.
 */
export function useChatUnread(): number {
  const { user, profile, isVerified, isStaff, isAdmin } = useAuth();
  const [latest, setLatest] = useState<Record<string, { at: number; mine: boolean }>>({});
  const [, bump] = useState(0);
  // Newest message id seen per room, to notify only about messages that arrive while the app is open.
  const seen = useRef<Record<string, string>>({});

  const rooms = useMemo(() => {
    if (!user || !isVerified) return [];
    return [
      ROOM_ALL,
      ...(profile?.purok ? [profile.purok] : []),
      ...(isStaff ? [ROOM_STAFF_ADMIN] : []),
      ...(isAdmin ? [ROOM_STAFF_OFFICIALS] : []),
    ];
  }, [user, isVerified, isStaff, isAdmin, profile?.purok]);

  useEffect(() => {
    if (rooms.length === 0) return;
    const cutoff = cutoffTimestamp();
    const unsubs = rooms.map((room) =>
      onSnapshot(
        query(collection(db, "chatRooms", room, "messages"), where("createdAt", ">=", cutoff), orderBy("createdAt", "desc"), limit(1)),
        (snap) => {
          const doc0 = snap.docs[0];
          if (!doc0 && seen.current[room] === undefined) seen.current[room] = ""; // empty room: the next message is new
          const d = doc0?.data() as { createdAt?: Timestamp; authorId?: string; authorName?: string; text?: string } | undefined;
          if (doc0 && d) {
            const known = seen.current[room];
            seen.current[room] = doc0.id;
            const viewing = window.location.pathname.startsWith("/chat") && document.visibilityState === "visible" && new URLSearchParams(window.location.search).get("room") === room;
            if (known !== undefined && known !== doc0.id && d.authorId !== user?.uid && isFresh(d.createdAt?.toMillis()) && !viewing) {
              const who = (d.authorName ?? "").split(" ")[0];
              // Staff rooms are private: keep the lock-screen text generic.
              const body = isStaffRoom(room) ? "May bagong mensahe" : `${who}: ${d.text ? (parseCall(d.text) ? "📹 Video call" : d.text.slice(0, 120)) : "📷 Larawan"}`;
              notifyNew("chat", `💬 ${roomTitle(room)}`, body, `chat:${room}`, `/chat/?room=${encodeURIComponent(room)}`);
            }
          }
          setLatest((prev) => ({ ...prev, [room]: { at: d?.createdAt?.toMillis() ?? 0, mine: d?.authorId === user?.uid } }));
        },
        () => {}, // No access to this room: nothing to show.
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [rooms, user?.uid]);

  // Re-count when a room is opened (same tab) or read in another tab.
  useEffect(() => {
    const again = () => bump((n) => n + 1);
    window.addEventListener(CHAT_READ_EVENT, again);
    window.addEventListener("storage", again);
    return () => {
      window.removeEventListener(CHAT_READ_EVENT, again);
      window.removeEventListener("storage", again);
    };
  }, []);

  return rooms.filter((r) => {
    const l = latest[r];
    return !!l && l.at > 0 && !l.mine && l.at > getLastRead(r);
  }).length;
}
