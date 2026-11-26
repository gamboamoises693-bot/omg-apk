/**
 * The glass themes the Developer can pick (Admin → Settings → Tema ng website).
 * The colors themselves live in globals.css (html[data-glass="key"]); this list is for the picker and the saved value.
 * "pasko" is not in the list: it is applied automatically while the Christmas look is on.
 */
export type GlassKey = "midnight" | "violet" | "crimson" | "teal" | "ocean" | "forest" | "sunset" | "graphite";

export interface GlassTheme {
  key: GlassKey;
  name: string;
  /** Preview swatch (same colors as in globals.css). */
  gradient: string;
  accent: string;
}

export const GLASS_THEMES: GlassTheme[] = [
  { key: "midnight", name: "Midnight", gradient: "linear-gradient(160deg,#1c3f8a 0%,#0f2350 40%,#070b16 100%)", accent: "#7cc4ff" },
  { key: "violet", name: "Violet Night", gradient: "linear-gradient(160deg,#7b2fbf 0%,#3b1670 40%,#0b0620 100%)", accent: "#c4b5fd" },
  { key: "crimson", name: "Crimson Night", gradient: "linear-gradient(160deg,#8f1d24 0%,#5a121a 40%,#12060a 100%)", accent: "#ffa8a8" },
  { key: "teal", name: "Aurora Teal", gradient: "linear-gradient(160deg,#10a58f 0%,#0b5d57 40%,#031a1f 100%)", accent: "#5eead4" },
  { key: "ocean", name: "Ocean Blue", gradient: "linear-gradient(160deg,#0e7fd0 0%,#0c4a8a 40%,#04122a 100%)", accent: "#7dd3fc" },
  { key: "forest", name: "Emerald Forest", gradient: "linear-gradient(160deg,#1f8a4a 0%,#14532d 40%,#04140b 100%)", accent: "#86efac" },
  { key: "sunset", name: "Sunset Amber", gradient: "linear-gradient(160deg,#d9531a 0%,#7c2d12 40%,#170904 100%)", accent: "#fdba74" },
  { key: "graphite", name: "Graphite", gradient: "linear-gradient(160deg,#4b5563 0%,#2a2f3a 40%,#0b0d12 100%)", accent: "#cbd5e1" },
];

export const DEFAULT_GLASS: GlassKey = "midnight";

export function isGlassKey(v: unknown): v is GlassKey {
  return typeof v === "string" && GLASS_THEMES.some((t) => t.key === v);
}
