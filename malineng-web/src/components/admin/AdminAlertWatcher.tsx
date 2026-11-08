"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellRing, Siren, X } from "lucide-react";
import { useAdminPending, PENDING_TAB, type PendingItem } from "@/context/AdminPendingContext";
import { ALERTS_EVENT, getAlertsEnabled, playAlertSound, registerServiceWorker, showSystemNotification, unlockAudio, vibrate } from "@/lib/alerts";

/**
 * Mounted once in the app shell. For admins who turned on alerts on this device, rings / notifies
 * for every NEW pending item: ambulance (siren if emergency), listings, posts, jobs, selfies, appointments.
 */
export function AdminAlertWatcher() {
  const { items, loading } = useAdminPending();
  const [enabled, setEnabled] = useState(false);
  const [latest, setLatest] = useState<{ item: PendingItem; count: number } | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const originalTitle = useRef("");

  useEffect(() => {
    const sync = () => setEnabled(getAlertsEnabled());
    sync();
    window.addEventListener(ALERTS_EVENT, sync);
    const unlock = () => void unlockAudio(); // browsers keep audio suspended until a tap
    window.addEventListener("pointerdown", unlock);
    return () => {
      window.removeEventListener(ALERTS_EVENT, sync);
      window.removeEventListener("pointerdown", unlock);
    };
  }, []);

  useEffect(() => {
    if (enabled) void registerServiceWorker();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      seen.current = null;
      return;
    }
    if (loading) return;
    // First snapshot = baseline: no alert for things that were already waiting.
    if (seen.current === null) {
      seen.current = new Set(items.map((i) => i.key));
      return;
    }
    const fresh = items.filter((i) => !seen.current!.has(i.key));
    fresh.forEach((i) => seen.current!.add(i.key));
    if (fresh.length === 0) return;

    const top = fresh.find((i) => i.emergency) ?? fresh[0];
    const kind = top.emergency ? "emergency" : "schedule";
    const url = `/admin/#${PENDING_TAB[top.kind]}`;
    const title = fresh.length > 1 && !top.emergency ? `${top.title} (+${fresh.length - 1} pa)` : top.title;

    playAlertSound(kind);
    vibrate(kind);
    void showSystemNotification(title, top.body, kind, top.key, url);
    setLatest({ item: top, count: fresh.length });

    if (document.visibilityState !== "visible") {
      originalTitle.current ||= document.title;
      document.title = `(${items.length}) ${top.title}`;
    }
  }, [enabled, items, loading]);

  useEffect(() => {
    const restore = () => {
      if (document.visibilityState === "visible" && originalTitle.current) {
        document.title = originalTitle.current;
        originalTitle.current = "";
      }
    };
    document.addEventListener("visibilitychange", restore);
    return () => document.removeEventListener("visibilitychange", restore);
  }, []);

  if (!enabled || !latest) return null;
  const { item, count } = latest;
  return (
    <div className={`no-print fixed inset-x-0 top-0 z-[70] px-3 pt-3 ${item.emergency ? "animate-pulse" : ""}`} role="alert">
      <div className={`mx-auto flex max-w-lg items-center gap-3 rounded-2xl p-3 text-white shadow-xl ${item.emergency ? "bg-red-600" : "bg-brand"}`}>
        {item.emergency ? <Siren className="h-7 w-7 shrink-0" /> : <BellRing className="h-6 w-6 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{item.title}{count > 1 ? ` (+${count - 1} pa)` : ""}</p>
          <p className="truncate text-sm text-white/90">{item.body}</p>
        </div>
        <Link href={`/admin/#${PENDING_TAB[item.kind]}`} onClick={() => setLatest(null)} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-brand">
          Buksan
        </Link>
        <button onClick={() => setLatest(null)} className="rounded-full p-1" aria-label="Isara">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
