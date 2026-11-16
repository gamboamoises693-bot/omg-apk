"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, where, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { isFresh, notifyNew } from "@/lib/notifyPrefs";
import { CHAT_READ_EVENT, ROOM_ALL, ROOM_STAFF_ADMIN, ROOM_STAFF_OFFICIALS, cutoffTimestamp, devRoomOf, getLastRead, helpRoomOf, isStaffRoom, parseCall, roomTitle, type DevChat, type HelpChat } from "@/lib/chat";

/**
 * Number of chat rooms with a message the person has not opened yet (for the bottom-nav badge).
 * Free-plan friendly: one listener per readable room, each limited to the single newest message,
 * and nothing is listened to for guests or people who cannot read the chat.
 * Staff watch the barangay room, their own Purok (if any) and the private staff rooms they belong to.
 */
export function useChatUnread(): number {
  const { user, profile, isVerified, isStaff, isAdmin, isSuperAdmin } = useAuth();
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

  // Direct chat with the Developer. One tiny listener: the person's own inbox line, or (for the Developer)
  // the newest 30 lines. Needs a login only, not verification.
  const [devLines, setDevLines] = useState<DevChat[]>([]);
  const devSeen = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!user) {
      setDevLines([]);
      return;
    }
    const answer = (lines: DevChat[]) => {
      setDevLines(lines);
      for (const c of lines) {
        const at = c.lastAt?.toMillis() ?? 0;
        const known = devSeen.current[c.id];
        devSeen.current[c.id] = at;
        // Only a message that arrives while the app is open, written by the other side, and not in the open chat.
        const wanted = isSuperAdmin ? c.lastFrom === "user" : c.lastFrom === "dev";
        const viewing = window.location.pathname.startsWith("/chat") && document.visibilityState === "visible" && new URLSearchParams(window.location.search).get("room") === devRoomOf(c.id);
        if (known !== undefined && at > known && wanted && isFresh(at) && !viewing) {
          notifyNew("chat", isSuperAdmin ? `💬 ${c.name || "Residente"}` : "💬 Developer", c.lastText.slice(0, 120), `chat:${devRoomOf(c.id)}`, `/chat/?room=${encodeURIComponent(devRoomOf(c.id))}`);
        }
      }
    };
    if (isSuperAdmin) {
      return onSnapshot(query(collection(db, "devChats"), orderBy("lastAt", "desc"), limit(30)), (snap) => answer(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DevChat)), () => {});
    }
    return onSnapshot(
      doc(db, "devChats", user.uid),
      (snap) => answer(snap.exists() ? [{ id: snap.id, ...snap.data() } as DevChat] : []),
      () => {},
    );
  }, [user, isSuperAdmin]);

  // Help with the account: the person hears when an admin answers (admins use the Admin menu badge instead).
  const [helpLine, setHelpLine] = useState<HelpChat | null>(null);
  const helpSeen = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!user || isStaff) {
      setHelpLine(null);
      return;
    }
    return onSnapshot(
      doc(db, "helpChats", user.uid),
      (snap) => {
        const c = snap.exists() ? ({ id: snap.id, ...snap.data() } as HelpChat) : null;
        setHelpLine(c);
        const at = c?.lastAt?.toMillis() ?? 0;
        const known = helpSeen.current;
        helpSeen.current = at;
        const viewing = window.location.pathname.startsWith("/chat") && document.visibilityState === "visible" && new URLSearchParams(window.location.search).get("room") === helpRoomOf(user.uid);
        if (c && known !== undefined && at > known && c.lastFrom === "staff" && isFresh(at) && !viewing) {
          notifyNew("chat", "💬 Tulong sa Setup", c.lastText.slice(0, 120), `chat:${helpRoomOf(user.uid)}`, `/chat/?room=${encodeURIComponent(helpRoomOf(user.uid))}`);
        }
      },
      () => {},
    );
  }, [user, isStaff]);

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

  const devUnread = devLines.filter((c) => {
    const at = c.lastAt?.toMillis() ?? 0;
    return at > 0 && c.lastFrom === (isSuperAdmin ? "user" : "dev") && at > getLastRead(devRoomOf(c.id));
  }).length;

  return (
    rooms.filter((r) => {
      const l = latest[r];
      return !!l && l.at > 0 && !l.mine && l.at > getLastRead(r);
    }).length + devUnread + (helpLine && helpLine.lastFrom === "staff" && (helpLine.lastAt?.toMillis() ?? 0) > getLastRead(helpRoomOf(helpLine.id)) ? 1 : 0)
  );
}
