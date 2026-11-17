"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { makeFaceThumb } from "@/lib/faceThumb";

/**
 * Small faces for the chat (chatAvatars/{uid}: a 48 px copy, about 2 KB). A resident's users document is private,
 * so each person publishes this tiny copy of their own face for the chat. Looked up once per person and kept in memory.
 */
const cache = new Map<string, string>(); // "" = looked up, no photo
const pending = new Set<string>();

/** Faces for these people ("" or missing = show initials). */
export function useChatAvatars(uids: string[]): Record<string, string> {
  const [, bump] = useState(0);
  const key = uids.join(",");
  useEffect(() => {
    const todo = uids.filter((u) => u && !cache.has(u) && !pending.has(u));
    if (todo.length === 0) return;
    todo.forEach((u) => pending.add(u));
    let alive = true;
    Promise.all(
      todo.map(async (u) => {
        try {
          const snap = await getDoc(doc(db, "chatAvatars", u));
          cache.set(u, snap.exists() ? String(snap.data().thumb ?? "") : "");
        } catch {
          cache.set(u, "");
        } finally {
          pending.delete(u);
        }
      }),
    ).then(() => alive && bump((n) => n + 1));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return Object.fromEntries(uids.map((u) => [u, cache.get(u) ?? ""]));
}

/** Publishes the signed-in person's own small face for the chat (once per photo, remembered on this phone). */
export function usePublishOwnAvatar(): void {
  const { user, profile } = useAuth();
  const source = (profile?.role !== "resident" ? profile?.photoURL : undefined) || profile?.faceThumb || "";
  useEffect(() => {
    if (!user || !source) return;
    const sig = `${user.uid}:${source.length}`;
    try {
      if (localStorage.getItem("malineng-chat-avatar") === sig) return;
    } catch {
      /* private mode: it is simply written again next time */
    }
    makeFaceThumb(source, 48, 0.6)
      .then((thumb) => setDoc(doc(db, "chatAvatars", user.uid), { thumb }))
      .then(() => {
        cache.delete(user.uid);
        try {
          localStorage.setItem("malineng-chat-avatar", sig);
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
  }, [user, source]);
}
