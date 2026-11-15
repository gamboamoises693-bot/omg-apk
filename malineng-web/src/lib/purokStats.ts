"use client";

import { useEffect, useState } from "react";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { usePuroks } from "@/lib/useSettings";

export interface PurokCount {
  purok: string;
  /** Accounts that chose this purok. */
  members: number;
  /** Of those, the ones whose selfie was verified. */
  verified: number;
}

export interface PurokCounts {
  rows: PurokCount[];
  /** Accounts with no purok (or a purok that is not in the list any more). */
  noPurok: number;
  total: number;
  verified: number;
  loading: boolean;
  failed: boolean;
}

const EMPTY: PurokCounts = { rows: [], noPurok: 0, total: 0, verified: 0, loading: true, failed: false };
const TTL_MS = 5 * 60_000;
let cache: { key: string; at: number; data: PurokCounts } | null = null;

/**
 * How many members each purok has. Staff only (the users list is private), so pass `enabled = isAdmin`.
 * It uses count queries (about one read per 1,000 accounts) and remembers the answer for 5 minutes,
 * so opening the screen again does not cost reads.
 */
export function usePurokCounts(enabled: boolean): PurokCounts {
  const puroks = usePuroks();
  const key = puroks.join("|");
  const [data, setData] = useState<PurokCounts>(() => (cache && cache.key === key ? cache.data : EMPTY));

  useEffect(() => {
    if (!enabled) return;
    if (cache && cache.key === key && Date.now() - cache.at < TTL_MS) {
      setData(cache.data);
      return;
    }
    let live = true;
    (async () => {
      try {
        const [per, total, verified] = await Promise.all([
          Promise.all(
            puroks.map(async (purok) => {
              const [m, v] = await Promise.all([
                getCountFromServer(query(collection(db, "users"), where("purok", "==", purok))),
                getCountFromServer(query(collection(db, "verifications"), where("purok", "==", purok), where("status", "==", "verified"))),
              ]);
              return { purok, members: m.data().count, verified: v.data().count };
            }),
          ),
          getCountFromServer(collection(db, "users")),
          getCountFromServer(collection(db, "verifiedUsers")),
        ]);
        const sum = per.reduce((n, r) => n + r.members, 0);
        const next: PurokCounts = { rows: per, noPurok: Math.max(0, total.data().count - sum), total: total.data().count, verified: verified.data().count, loading: false, failed: false };
        cache = { key, at: Date.now(), data: next };
        if (live) setData(next);
      } catch (err) {
        console.warn("[purokStats] failed:", err);
        if (live) setData({ ...EMPTY, loading: false, failed: true });
      }
    })();
    return () => {
      live = false;
    };
  }, [enabled, key, puroks]);

  return data;
}
