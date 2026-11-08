"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

let cache: Set<string> = new Set();
let listeners: Array<(s: Set<string>) => void> = [];
let unsub: (() => void) | null = null;

/** Live set of verified user ids (public verifiedUsers collection), shared across components. */
export function useVerifiedSet(): Set<string> {
  const [set, setSet] = useState<Set<string>>(cache);

  useEffect(() => {
    listeners.push(setSet);
    if (!unsub) {
      unsub = onSnapshot(
        collection(db, "verifiedUsers"),
        (snap) => {
          cache = new Set(snap.docs.map((d) => d.id));
          listeners.forEach((l) => l(cache));
        },
        (err) => console.warn("[verified] listener error:", err),
      );
    }
    return () => {
      listeners = listeners.filter((l) => l !== setSet);
      if (listeners.length === 0 && unsub) {
        unsub();
        unsub = null;
      }
    };
  }, []);

  return set;
}
