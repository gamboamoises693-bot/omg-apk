const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 });

export function money(n: number | undefined | null): string {
  return peso.format(Number(n ?? 0)).replace("PHP", "₱");
}

/** yyyy-mm-dd in Asia/Manila, used as the day key for stats. */
export function manilaDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(d);
}

/** Start of the current Manila day as a Date (UTC instant). */
export function startOfManilaDay(d: Date = new Date()): Date {
  return new Date(`${manilaDay(d)}T00:00:00+08:00`);
}

export function fmtDate(d: Date | null | undefined): string {
  if (!d) return "-";
  return d.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "-";
  return d.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function maskPhone(p: string): string {
  return p && p.length >= 11 ? `${p.slice(0, 4)}***${p.slice(-4)}` : p;
}

export const PHONE_RE = /^09\d{9}$/;

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("639") && digits.length === 12) return `0${digits.slice(2)}`;
  return digits;
}
