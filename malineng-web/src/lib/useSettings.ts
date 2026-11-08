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
          // Blank saved numbers fall back to the defaults (e.g. BFP Cuyapo).
          emergencyNumbers: {
            tanod: data.emergencyNumbers?.tanod || DEFAULT_SETTINGS.emergencyNumbers.tanod,
            healthCenter: data.emergencyNumbers?.healthCenter || DEFAULT_SETTINGS.emergencyNumbers.healthCenter,
            bfp: data.emergencyNumbers?.bfp || DEFAULT_SETTINGS.emergencyNumbers.bfp,
          },
          hotlines: Array.isArray(data.hotlines) ? data.hotlines : DEFAULT_SETTINGS.hotlines,
          ambulance: { ...DEFAULT_SETTINGS.ambulance, ...(data.ambulance ?? {}) },
          // An empty array is a valid admin choice (all projects removed); only fall back when never saved.
          projects: Array.isArray(data.projects) ? data.projects : DEFAULT_SETTINGS.projects,
          puroks: data.puroks?.length ? data.puroks : DEFAULT_SETTINGS.puroks,
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

/** Purok list managed by the admin in /admin > Settings. */
export function usePuroks(): string[] {
  return useSettings().settings.puroks;
}
