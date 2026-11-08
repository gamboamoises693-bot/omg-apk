"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { collection, query, where } from "firebase/firestore";
import { Siren, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { ALERTS_EVENT, getAlertsEnabled, playAlertSound, registerServiceWorker, showSystemNotification, unlockAudio, vibrate } from "@/lib/alerts";
import { formatTime12 } from "@/lib/ambulance";
import { formatDate } from "@/lib/format";
import type { AmbulanceRequest } from "@/lib/types";

/**
 * Mounted once in the app shell. For admins who turned on alerts on this device,
 * it listens for NEW pending ambulance requests and rings / notifies.
 */
export function AmbulanceAlertWatcher() {
  const { isAdmin } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [latest, setLatest] = useState<AmbulanceRequest | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const originalTitle = useRef<string>("");

  // Read the per-device preference and react to changes from the settings card.
  useEffect(() => {
    const sync = () => setEnabled(getAlertsEnabled());
    sync();
    window.addEventListener(ALERTS_EVENT, sync);
    // Any tap re-unlocks audio (browsers suspend it until a user gesture).
    const unlock = () => void unlockAudio();
    window.addEventListener("pointerdown", unlock);
    return () => {
      window.removeEventListener(ALERTS_EVENT, sync);
      window.removeEventListener("pointerdown", unlock);
    };
  }, []);

  const active = isAdmin && enabled;
  useEffect(() => {
    if (active) void registerServiceWorker();
  }, [active]);

  const q = useMemo(() => (active ? query(collection(db, "ambulanceRequests"), where("status", "==", "pending")) : null), [active]);
  const { data, loading } = useCollection<AmbulanceRequest>(q);

  useEffect(() => {
    if (!active) {
      seen.current = null;
      return;
    }
    if (loading) return;
    // First snapshot = baseline: don't ring for requests that already existed.
    if (seen.current === null) {
      seen.current = new Set(data.map((r) => r.id));
      return;
    }
    const fresh = data.filter((r) => !seen.current!.has(r.id));
    fresh.forEach((r) => seen.current!.add(r.id));
    if (fresh.length === 0) return;

    const top = fresh.find((r) => r.type === "emergency") ?? fresh[0];
    const kind = top.type;
    const title = kind === "emergency" ? "🚨 EMERGENCY: Ambulansya" : "🚑 Bagong schedule request";
    const body =
      kind === "emergency"
        ? `${top.patientName} · ${top.reason} · ${top.pickup}`
        : `${top.patientName} · ${top.reason} · ${formatDate(top.date)} ${formatTime12(top.time)}`;

    playAlertSound(kind);
    vibrate(kind);
    void showSystemNotification(title, body, kind, `amb-${top.id}`);
    setLatest(top);

    if (document.visibilityState !== "visible") {
      originalTitle.current ||= document.title;
      document.title = `(${fresh.length}) ${title}`;
    }
  }, [active, data, loading]);

  // Restore the tab title when the admin comes back.
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

  if (!active || !latest) return null;
  const emergency = latest.type === "emergency";
  return (
    <div className={`fixed inset-x-0 top-0 z-[70] px-3 pt-3 ${emergency ? "animate-pulse" : ""}`} role="alert">
      <div className={`mx-auto flex max-w-lg items-center gap-3 rounded-2xl p-3 text-white shadow-xl ${emergency ? "bg-red-600" : "bg-brand"}`}>
        <Siren className="h-8 w-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-black">{emergency ? "EMERGENCY REQUEST!" : "Bagong ambulance request"}</p>
          <p className="truncate text-sm text-white/90">{latest.patientName} · {latest.pickup}</p>
        </div>
        <Link href="/admin/#ambulansya" onClick={() => setLatest(null)} className="rounded-xl bg-white px-3 py-2 font-bold text-red-700">Buksan</Link>
        <button onClick={() => setLatest(null)} className="rounded-full p-1" aria-label="Isara">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
