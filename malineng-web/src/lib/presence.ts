"use client";

import { useEffect, useState } from "react";
import { Timestamp, collection, doc, getCountFromServer, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

/**
 * "Online now" counter on the free plan, without Realtime Database:
 * every open device (logged in or guest) writes presence/{deviceId}.lastSeen
 * every 2 minutes while the page is visible. A device counts as online when
 * it was seen in the last 5 minutes.
 */
const BEAT_MS = 2 * 60_000;
const ONLINE_WINDOW_MS = 5 * 60_000;
const COUNT_REFRESH_MS = 2 * 60_000;
const DEVICE_KEY = "malineng.deviceId";

let lastBeat = 0;

function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id || !/^[a-z0-9]{20}$/.test(id)) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    // Private mode / storage blocked: one id per page load is good enough.
    return Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
  }
}

async function beat(): Promise<void> {
  if (!isFirebaseConfigured || document.visibilityState !== "visible") return;
  if (Date.now() - lastBeat < 60_000) return; // throttle extra triggers
  lastBeat = Date.now();
  try {
    await setDoc(doc(db, "presence", deviceId()), { lastSeen: serverTimestamp() });
  } catch (err) {
    lastBeat = 0;
    console.warn("[presence] heartbeat failed:", err);
  }
}

/** Mount once (in Providers): keeps this device marked online while the site is open. */
export function PresenceBeat(): null {
  useEffect(() => {
    beat();
    const timer = setInterval(beat, BEAT_MS);
    const onVisible = () => document.visibilityState === "visible" && beat();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}

/** Number of devices online in the last 5 minutes (refreshed every 2 minutes while visible). */
export function useOnlineCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const cutoff = Timestamp.fromMillis(Date.now() - ONLINE_WINDOW_MS);
        const snap = await getCountFromServer(query(collection(db, "presence"), where("lastSeen", ">=", cutoff)));
        // At least 1: the person looking at it is online too (their beat may still be in flight).
        if (alive) setCount(Math.max(1, snap.data().count));
      } catch (err) {
        console.warn("[presence] count failed:", err);
      }
    };
    // Small delay so our own heartbeat lands first.
    const first = setTimeout(load, 1500);
    const timer = setInterval(load, COUNT_REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return count;
}
