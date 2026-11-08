"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { DEFAULT_SETTINGS } from "./defaults";
import type { Settings } from "./types";

/** Live settings/main document merged on top of defaults. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "settings", "main"),
      (snap) => {
        const data = (snap.data() ?? {}) as Partial<Settings>;
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data,
          emergencyNumbers: { ...DEFAULT_SETTINGS.emergencyNumbers, ...(data.emergencyNumbers ?? {}) },
          projects: data.projects?.length ? data.projects : DEFAULT_SETTINGS.projects,
        });
        setLoading(false);
      },
      (err) => {
        console.error("[settings] listener error:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  return { settings, loading };
}
