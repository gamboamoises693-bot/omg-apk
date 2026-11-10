"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { verifiedSetRef } from "./verified";

let cache: Set<string> = new Set();
let listeners: Array<(s: Set<string>) => void> = [];
let unsub: (() => void) | null = null;

/** Live set of verified user ids (one document: stats/verifiedSet), shared across components. */
export function useVerifiedSet(): Set<string> {
  const [set, setSet] = useState<Set<string>>(cache);

  useEffect(() => {
    listeners.push(setSet);
    if (!unsub) {
      unsub = onSnapshot(
        verifiedSetRef(),
        (snap) => {
          const uids = snap.data()?.uids;
          cache = new Set<string>(Array.isArray(uids) ? (uids as string[]) : []);
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
