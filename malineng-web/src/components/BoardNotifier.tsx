"use client";

import { useEffect, useRef } from "react";
import { collection, limit, onSnapshot, orderBy, query, where, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { isFresh, notifyNew } from "@/lib/notifyPrefs";

/**
 * Mounted once in the app shell. Watches only the newest approved Board post (one document),
 * so it costs a single read per new post. Shows a phone notification for a post by someone else.
 */
export function BoardNotifier() {
  const { user } = useAuth();
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    lastId.current = null;
    return onSnapshot(
      query(collection(db, "posts"), where("status", "==", "approved"), orderBy("createdAt", "desc"), limit(1)),
      (snap) => {
        const d = snap.docs[0];
        if (!d) return;
        const first = lastId.current === null;
        const changed = lastId.current !== d.id;
        lastId.current = d.id;
        if (first || !changed) return; // the first snapshot is just the current newest post
        const data = d.data() as { authorId: string; authorName: string; content: string; createdAt?: Timestamp };
        if (data.authorId === user.uid || !isFresh(data.createdAt?.toMillis(), 6 * 60 * 60_000)) return;
        if (window.location.pathname.replace(/\/$/, "") === "/board" && document.visibilityState === "visible") return;
        notifyNew("board", "📝 Bagong post sa Board", `${data.authorName.split(" ")[0]}: ${data.content.slice(0, 120)}`, `board:${d.id}`, "/board");
      },
      () => {},
    );
  }, [user]);

  return null;
}
