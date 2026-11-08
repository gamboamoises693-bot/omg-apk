/** Per-device text size ("Aa" setting). Stored in localStorage, applied as <html data-text-size>. */
export const TEXT_SIZES = [
  { key: "normal", label: "Normal", sample: "Aa" },
  { key: "malaki", label: "Malaki", sample: "Aa" },
  { key: "pinakamalaki", label: "Pinakamalaki", sample: "Aa" },
] as const;

export type TextSize = (typeof TEXT_SIZES)[number]["key"];
const KEY = "malineng-text-size";

export function getTextSize(): TextSize {
  try {
    const v = localStorage.getItem(KEY);
    return v === "malaki" || v === "pinakamalaki" ? v : "normal";
  } catch {
    return "normal";
  }
}

export function setTextSize(size: TextSize): void {
  try {
    localStorage.setItem(KEY, size);
  } catch {
    /* storage blocked: applies for this visit only */
  }
  applyTextSize(size);
}

export function applyTextSize(size: TextSize): void {
  if (size === "normal") document.documentElement.removeAttribute("data-text-size");
  else document.documentElement.setAttribute("data-text-size", size);
}

/** Inline script for <head>: applies the saved size before first paint (no flash of small text). */
export const TEXT_SIZE_BOOT_SCRIPT = `try{var s=localStorage.getItem("${KEY}");if(s==="malaki"||s==="pinakamalaki")document.documentElement.setAttribute("data-text-size",s)}catch(e){}`;
