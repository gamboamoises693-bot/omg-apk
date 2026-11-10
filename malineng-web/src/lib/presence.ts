"use client";

import { useEffect, useState } from "react";
import { Timestamp, arrayUnion, collection, doc, getCountFromServer, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase";

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
let lastUserBeat = { uid: "", at: 0 };

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
  await beatUser();
}

/**
 * Logged-in users also mark presenceUsers/{uid} (only the Super Admin can read it),
 * so the Super Admin can see WHO is online. Runs right away after login too.
 */
async function beatUser(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || document.visibilityState !== "visible") return;
  if (lastUserBeat.uid === uid && Date.now() - lastUserBeat.at < 60_000) return;
  lastUserBeat = { uid, at: Date.now() };
  try {
    // `devices` lets the Super Admin spot several accounts used on one phone.
    await setDoc(doc(db, "presenceUsers", uid), { lastSeen: serverTimestamp(), devices: arrayUnion(deviceId()) }, { merge: true });
  } catch (err) {
    lastUserBeat = { uid: "", at: 0 };
    console.warn("[presence] user heartbeat failed:", err);
  }
}

/** Super Admin: uids of logged-in users seen in the last 5 minutes. */
export async function fetchOnlineUserIds(): Promise<{ uid: string; lastSeen: number }[]> {
  const cutoff = Timestamp.fromMillis(Date.now() - ONLINE_WINDOW_MS);
  const snap = await getDocs(query(collection(db, "presenceUsers"), where("lastSeen", ">=", cutoff)));
  return snap.docs
    .map((d) => ({ uid: d.id, lastSeen: (d.data().lastSeen as Timestamp | undefined)?.toMillis() ?? 0 }))
    .sort((a, b) => b.lastSeen - a.lastSeen);
}

/** Mount once (in Providers): keeps this device marked online while the site is open. */
export function PresenceBeat(): null {
  useEffect(() => {
    beat();
    const timer = setInterval(beat, BEAT_MS);
    // Mark the user online as soon as they log in (not only on the next 2-minute beat).
    const unsubAuth = auth.onAuthStateChanged((u) => u && void beatUser());
    const onVisible = () => document.visibilityState === "visible" && beat();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      unsubAuth();
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
