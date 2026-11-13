import { notificationPermission, playAlertSound, showSystemNotification, vibrate } from "@/lib/alerts";

/**
 * Per-device choices for phone notifications about Chat, Board and Pabatid.
 * Free plan: these only ring while the website is open (also in the background),
 * because true push while the app is closed needs a paid server.
 */
export type NotifyKind = "chat" | "board" | "pabatid";

const KEY = "malineng-notify";
export const NOTIFY_EVENT = "malineng-notify-changed";

type Prefs = Partial<Record<NotifyKind, boolean>>;

function readPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Prefs;
  } catch {
    return {};
  }
}

/** On by default; the person can switch each kind off. */
export function notifyPref(kind: NotifyKind): boolean {
  return readPrefs()[kind] !== false;
}

export function setNotifyPref(kind: NotifyKind, on: boolean): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readPrefs(), [kind]: on }));
  } catch {
    /* storage blocked: the choice just will not persist */
  }
  window.dispatchEvent(new Event(NOTIFY_EVENT));
}

/** True when the browser allows notifications and the person did not switch this kind off. */
export function notifyAllowed(kind: NotifyKind): boolean {
  return typeof window !== "undefined" && notificationPermission() === "granted" && notifyPref(kind);
}

/** Phone notification + chime/vibration (the chime only plays while the page is visible). */
export function notifyNew(kind: NotifyKind, title: string, body: string, tag: string, url: string): void {
  if (!notifyAllowed(kind)) return;
  void showSystemNotification(title, body, "schedule", tag, url);
  if (document.visibilityState === "visible") playAlertSound("schedule");
  vibrate("schedule");
}

/** A message/post counts as "new" only if it was created in the last minute (ignores cached old data on startup). */
export function isFresh(createdMillis: number | undefined, windowMs = 60_000): boolean {
  return !!createdMillis && Date.now() - createdMillis < windowMs;
}
