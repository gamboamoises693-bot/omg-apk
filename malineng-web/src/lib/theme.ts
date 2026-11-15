"use client";

import { useSyncExternalStore } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Seasonal look (Christmas) for the whole app. The Developer sets it in Admin → Settings → "Tema ng Pasko":
 * - "auto": on between the two dates, every year (only the month and day count, not the year)
 * - "on": always on, "off": always off
 */
export type XmasMode = "auto" | "on" | "off";

export interface ThemeConfig {
  xmas: XmasMode;
  /** YYYY-MM-DD. The year is ignored: the season repeats every year. */
  from: string;
  to: string;
}

export const DEFAULT_THEME: ThemeConfig = { xmas: "auto", from: "2026-11-15", to: "2027-01-06" };

/** Month and day as one number (Nov 15 = 1115) from a YYYY-MM-DD string. NaN when the text is not a date. */
function monthDay(iso: string): number {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(iso);
  return m ? Number(m[1]) * 100 + Number(m[2]) : NaN;
}

/** Whether the Christmas look is on at the given time. A range that crosses New Year (Nov 15 to Jan 6) works. */
export function isXmas(cfg: ThemeConfig, nowMs: number): boolean {
  if (cfg.xmas === "on") return true;
  if (cfg.xmas === "off") return false;
  const from = monthDay(cfg.from);
  const to = monthDay(cfg.to);
  const d = new Date(nowMs);
  const today = (d.getMonth() + 1) * 100 + d.getDate();
  if (Number.isNaN(from) || Number.isNaN(to)) return isXmas(DEFAULT_THEME, nowMs);
  return from <= to ? today >= from && today <= to : today >= from || today <= to;
}

/* ---- One shared listener for settings/theme (started by the first component that asks for it) ---- */
let current: ThemeConfig = DEFAULT_THEME;
const listeners = new Set<() => void>();
let stop: (() => void) | null = null;

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (!stop) {
    stop = onSnapshot(
      doc(db, "settings", "theme"),
      (snap) => {
        const d = (snap.data() ?? {}) as Partial<ThemeConfig>;
        current = {
          xmas: d.xmas === "on" || d.xmas === "off" ? d.xmas : "auto",
          from: typeof d.from === "string" && d.from ? d.from : DEFAULT_THEME.from,
          to: typeof d.to === "string" && d.to ? d.to : DEFAULT_THEME.to,
        };
        listeners.forEach((l) => l());
      },
      () => {}, // No document or no access: the default season applies.
    );
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && stop) {
      stop();
      stop = null;
    }
  };
}

export function useTheme(): ThemeConfig {
  return useSyncExternalStore(subscribe, () => current, () => DEFAULT_THEME);
}

/** True while the Christmas look is on (login, Home, menus, raffle and sponsors all follow this). */
export function useXmas(): boolean {
  return isXmas(useTheme(), Date.now());
}
