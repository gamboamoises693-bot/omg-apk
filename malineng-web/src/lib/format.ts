import type { Timestamp } from "firebase/firestore";

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

export function formatPeso(value: number): string {
  return Number.isFinite(value) ? pesoFormatter.format(value) : "₱0";
}

export function tsToMillis(ts?: Timestamp | null): number {
  // serverTimestamp() is null for a moment right after a local write.
  return ts?.toMillis?.() ?? Date.now();
}

export function timeAgo(ts?: Timestamp | null): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - tsToMillis(ts)) / 1000));
  if (diffSec < 60) return "Ngayon lang";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min} minuto na`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} oras na`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} araw na`;
  return formatDate(new Date(tsToMillis(ts)));
}

export function formatDate(input: Date | string): string {
  const d = typeof input === "string" ? new Date(`${input}T00:00:00`) : input;
  if (Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleDateString("fil-PH", { year: "numeric", month: "long", day: "numeric" });
}

/** Today as YYYY-MM-DD in local time (for <input type="date" min>). */
export function todayISO(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

/** Newest first, safe for docs with pending serverTimestamp. */
export function sortNewest<T extends { createdAt?: Timestamp }>(items: T[]): T[] {
  return [...items].sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
}

/** Normalize PH mobile number to a tel: friendly string. */
export function telHref(contact: string): string {
  return `tel:${contact.replace(/[^\d+]/g, "")}`;
}

/** Only allow real Messenger / Facebook links to avoid phishing links. */
export function safeMessengerLink(link: string): string | null {
  const trimmed = link.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const allowed = ["m.me", "www.m.me", "messenger.com", "www.messenger.com", "facebook.com", "www.facebook.com", "m.facebook.com"];
    return allowed.includes(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function friendlyError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-credential": "Mali ang email o password.",
    "auth/wrong-password": "Mali ang password.",
    "auth/user-not-found": "Walang account na ganitong email.",
    "auth/email-already-in-use": "May account na ang email na ito. Mag-login na lang.",
    "auth/weak-password": "Masyadong mahina ang password (dapat 6 characters pataas).",
    "auth/invalid-email": "Mali ang format ng email.",
    "auth/popup-closed-by-user": "Isinara ang Google login window.",
    "auth/too-many-requests": "Masyadong maraming subok. Maghintay muna ng ilang minuto.",
    "auth/network-request-failed": "Walang internet connection. Subukan ulit.",
    "auth/requires-recent-login": "Para sa seguridad, mag-login ulit bago gawin ito.",
    "auth/missing-password": "Ilagay ang password mo.",
    "permission-denied": "Wala kang permiso para dito. Naka-login ka ba?",
    unavailable: "Mahina ang internet. Subukan ulit.",
  };
  if (map[code]) return map[code];
  // Our own thrown errors (e.g. upload validation) have no code: show their message.
  if (!code && err instanceof Error && err.message) return err.message;
  return "May problema. Subukan ulit mamaya.";
}

/**
 * Filter tabs for a list that has "Iba pa": the listed choices (without "Iba pa"), then every custom value
 * people wrote (most common first), then "Iba pa" last.
 */
export function withCustomOptions(known: readonly string[], values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const v of values) if (v && !known.includes(v)) counts.set(v, (counts.get(v) ?? 0) + 1);
  const custom = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
  const list = known.filter((k) => k !== "Iba pa");
  return [...list, ...custom, ...(known.includes("Iba pa") ? ["Iba pa"] : [])];
}

/**
 * "  welder  / "WELDER" / "welder" -> "Welder". Used for skills that residents write themselves,
 * so the same skill typed in different ways is grouped as one.
 */
export function normalizeSkillLabel(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 40)
    .toLowerCase()
    .replace(/(^|[\s/-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Lowercase + collapse spaces. Used for ayuda.nameLower matching. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
