"use client";

import { useCallback, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { RefreshCw } from "lucide-react";
import { db } from "@/lib/firebase";
import { fetchOnlineUserIds } from "@/lib/presence";
import { roleLabel } from "@/lib/activity";
import type { UserProfile } from "@/lib/types";
import { Avatar } from "./Avatar";
import { Spinner } from "./ui";

interface Row {
  uid: string;
  lastSeen: number;
  profile: UserProfile | null;
}

// Profiles rarely change while the sheet is open: cache them per page load.
const profileCache = new Map<string, UserProfile | null>();

async function loadProfile(uid: string): Promise<UserProfile | null> {
  if (profileCache.has(uid)) return profileCache.get(uid)!;
  const snap = await getDoc(doc(db, "users", uid)).catch(() => null);
  const p = snap?.exists() ? (snap.data() as UserProfile) : null;
  profileCache.set(uid, p);
  return p;
}

function ago(ms: number): string {
  const min = Math.floor((Date.now() - ms) / 60_000);
  return min <= 0 ? "ngayon lang" : `${min} min ang nakaraan`;
}

/** Super Admin only: who is on the website right now (logged-in users) + guest count. */
export function OnlineUsers({ totalDevices }: { totalDevices: number | null }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const online = await fetchOnlineUserIds();
      const withProfiles = await Promise.all(online.map(async (o) => ({ ...o, profile: await loadProfile(o.uid) })));
      setRows(withProfiles);
    } catch (err) {
      console.warn("[online] load failed:", err);
      setError("Hindi ma-load ang listahan. Subukan ulit.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (rows === null && !error) return <Spinner />;

  const guests = totalDevices !== null && rows ? Math.max(0, totalDevices - rows.length) : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-brand-light p-3">
          <p className="text-xl font-extrabold text-brand">{rows?.length ?? 0}</p>
          <p className="text-xs text-gray-600">Naka-login</p>
        </div>
        <div className="rounded-2xl bg-gray-50 p-3">
          <p className="text-xl font-extrabold">{guests ?? "—"}</p>
          <p className="text-xs text-gray-600">Bisita (hindi naka-login)</p>
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {rows && rows.length > 0 && (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100">
          {rows.map((r) => {
            const name = r.profile?.fullName ?? "Hindi kilalang account";
            return (
              <li key={r.uid} className="flex items-center gap-3 px-3 py-2.5">
                <span className="relative">
                  <Avatar name={name} photo={r.profile && r.profile.role !== "resident" ? r.profile.photoURL : undefined} size="h-9 w-9" textClass="text-xs" fallbackClass="bg-brand-light text-brand" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{name}</p>
                  <p className="truncate text-xs text-gray-500">
                    {r.profile ? `${roleLabel(r.profile.role, r.profile.position)}${r.profile.purok ? ` · ${r.profile.purok}` : ""}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[0.7rem] text-gray-500">{ago(r.lastSeen)}</span>
              </li>
            );
          })}
        </ul>
      )}
      {rows && rows.length === 0 && !error && <p className="text-center text-sm text-gray-500">Walang naka-login ngayon.</p>}

      <button onClick={load} disabled={busy} className="mx-auto flex items-center gap-1.5 text-sm font-semibold text-brand disabled:opacity-50">
        <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> I-refresh
      </button>
      <p className="text-center text-[0.7rem] text-gray-400">Online = bukas ang website sa nakaraang 5 minuto.</p>
    </div>
  );
}
