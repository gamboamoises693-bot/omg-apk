/**
 * Free, serverless admin alerts for new ambulance requests.
 * Works while the website is open in the browser (even in the background):
 * system notification + siren/chime sound + vibration.
 * True push while the browser is closed would need Cloud Functions (Blaze plan).
 */

const PREF_KEY = "malineng-amb-alerts";
export const ALERTS_EVENT = "malineng-alerts-changed";

export type AlertKind = "emergency" | "schedule";

/* ---------- Preference (per device) ---------- */
export function getAlertsEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === "on";
  } catch {
    return false;
  }
}

export function setAlertsEnabled(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    /* storage blocked: alerts just won't persist */
  }
  window.dispatchEvent(new Event(ALERTS_EVENT));
}

/* ---------- Notification permission + service worker ---------- */
export type PermissionState = "granted" | "denied" | "default" | "unsupported";

export function notificationPermission(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as PermissionState;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (err) {
    console.warn("[alerts] service worker registration failed:", err);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (notificationPermission() === "unsupported") return "unsupported";
  const result = await Notification.requestPermission();
  return result as PermissionState;
}

/** Shows a system notification. Uses the service worker (required on Android), falls back to `new Notification`. */
export async function showSystemNotification(title: string, body: string, kind: AlertKind, tag: string): Promise<void> {
  if (notificationPermission() !== "granted") return;
  const options: NotificationOptions & { vibrate?: number[]; requireInteraction?: boolean } = {
    body,
    tag,
    icon: "/icon.svg",
    badge: "/icon.svg",
    requireInteraction: kind === "emergency",
    vibrate: kind === "emergency" ? [400, 150, 400, 150, 400] : [200, 100, 200],
    data: { url: "/admin/#ambulansya" },
  };
  try {
    const reg = (await navigator.serviceWorker?.getRegistration()) ?? (await registerServiceWorker());
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
    new Notification(title, options);
  } catch (err) {
    console.warn("[alerts] notification failed:", err);
  }
}

/* ---------- Sound (Web Audio, no audio files needed) ---------- */
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioCtx ??= new Ctor();
  return audioCtx;
}

/** Browsers only allow sound after a tap. Call this inside a click handler. */
export async function unlockAudio(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") await ctx.resume().catch(() => undefined);
}

/** Emergency = rising/falling siren (~3s). Schedule = two-note chime. */
export function playAlertSound(kind: AlertKind): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);

  if (kind === "emergency") {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.05);
    for (let i = 0; i < 6; i++) {
      osc.frequency.setValueAtTime(650, now + i * 0.5);
      osc.frequency.linearRampToValueAtTime(1250, now + i * 0.5 + 0.25);
      osc.frequency.linearRampToValueAtTime(650, now + i * 0.5 + 0.5);
    }
    gain.gain.setValueAtTime(0.25, now + 2.9);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 3.05);
  } else {
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + i * 0.22;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }
}

export function vibrate(kind: AlertKind): void {
  try {
    navigator.vibrate?.(kind === "emergency" ? [400, 150, 400, 150, 400] : [200, 100, 200]);
  } catch {
    /* not supported */
  }
}
