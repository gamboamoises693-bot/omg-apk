"use client";

import { useEffect, useState } from "react";
import { onSnapshot, type Query, type DocumentData } from "firebase/firestore";

/**
 * Live Firestore query -> typed array with id.
 * Pass `null` to skip (e.g. while user is not loaded yet).
 * NOTE: build the query with useMemo so it does not re-subscribe every render.
 */
export function useCollection<T extends { id: string }>(q: Query<DocumentData> | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(!!q);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("[useCollection]", err);
        setError("Hindi ma-load ang data. I-check ang internet.");
        setLoading(false);
      },
    );
    return unsub;
  }, [q]);

  return { data, loading, error };
}
