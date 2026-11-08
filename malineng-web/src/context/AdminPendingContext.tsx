"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./AuthContext";
import { useCollection } from "@/lib/useCollection";
import { formatTime12 } from "@/lib/ambulance";
import { isLate, linesText, type BorrowRequest } from "@/lib/hiraman";
import type { AmbulanceRequest, Appointment, Job, Listing, Post, Verification } from "@/lib/types";

/** Admin tab that handles each kind of pending item (see app/admin/page.tsx). */
export const PENDING_TAB = {
  ambulance: "ambulansya",
  listing: "approve",
  post: "approve",
  job: "approve",
  verification: "verification",
  appointment: "appointments",
  borrow: "hiraman",
  place: "mapa",
  borrowLate: "hiraman",
} as const;

export type PendingKind = keyof typeof PENDING_TAB;

export interface PendingItem {
  key: string; // unique across kinds
  kind: PendingKind;
  title: string;
  body: string;
  emergency: boolean;
}

interface Value {
  items: PendingItem[];
  loading: boolean;
  total: number;
  byTab: Record<string, number>;
}

const EMPTY: Value = { items: [], loading: false, total: 0, byTab: {} };
const Ctx = createContext<Value>(EMPTY);

/**
 * One set of live listeners for everything waiting on an admin.
 * Used by the shield badge, the admin tab badges and the phone alerts.
 */
export function AdminPendingProvider({ children }: { children: ReactNode }) {
  const { isAdmin, canBorrowAdmin } = useAuth();
  // Hiraman: only the approvers listen. Waiting requests + borrowed items past their return time.
  const borrowQ = useMemo(
    () => (canBorrowAdmin ? query(collection(db, "borrowRequests"), where("status", "in", ["pending", "approved", "borrowed"])) : null),
    [canBorrowAdmin],
  );
  const borrow = useCollection<BorrowRequest>(borrowQ);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const q = useMemo(() => {
    if (!isAdmin) return null;
    return {
      amb: query(collection(db, "ambulanceRequests"), where("status", "==", "pending")),
      listings: query(collection(db, "listings"), where("status", "==", "pending")),
      posts: query(collection(db, "posts"), where("status", "==", "pending")),
      jobs: query(collection(db, "jobs"), where("status", "==", "pending")),
      ver: query(collection(db, "verifications"), where("status", "==", "pending")),
      appts: query(collection(db, "appointments"), where("status", "==", "natanggap")),
      places: query(collection(db, "places"), where("status", "==", "pending")),
    };
  }, [isAdmin]);

  const amb = useCollection<AmbulanceRequest>(q?.amb ?? null);
  const listings = useCollection<Listing>(q?.listings ?? null);
  const posts = useCollection<Post>(q?.posts ?? null);
  const jobs = useCollection<Job>(q?.jobs ?? null);
  const ver = useCollection<Verification>(q?.ver ?? null);
  const appts = useCollection<Appointment>(q?.appts ?? null);
  const places = useCollection<{ id: string; name: string; ownerName: string; category: string }>(q?.places ?? null);

  const value = useMemo<Value>(() => {
    if (!isAdmin) return EMPTY;
    const items: PendingItem[] = [
      ...amb.data.map((r) => ({
        key: `ambulance:${r.id}`,
        kind: "ambulance" as const,
        emergency: r.type === "emergency",
        title: r.type === "emergency" ? "🚨 EMERGENCY: Ambulansya" : "🚑 Bagong schedule ng ambulansya",
        body: r.type === "emergency" ? `${r.patientName} · ${r.reason} · ${r.pickup}` : `${r.patientName} · ${r.reason} · ${r.date} ${formatTime12(r.time)}`,
      })),
      ...listings.data.map((l) => ({ key: `listing:${l.id}`, kind: "listing" as const, emergency: false, title: "🛍️ Bagong paninda", body: `${l.sellerName}: ${l.title}` })),
      ...posts.data.map((p) => ({ key: `post:${p.id}`, kind: "post" as const, emergency: false, title: "💬 Bagong post sa Board", body: `${p.authorName}: ${p.content.slice(0, 80)}` })),
      ...jobs.data.map((j) => ({ key: `job:${j.id}`, kind: "job" as const, emergency: false, title: "💼 Bagong trabaho", body: `${j.posterName}: ${j.title}` })),
      ...ver.data.map((v) => ({ key: `verification:${v.id}`, kind: "verification" as const, emergency: false, title: "✓ Bagong selfie para i-verify", body: `${v.fullName} · ${v.purok || "walang purok"}` })),
      ...appts.data.map((a) => ({ key: `appointment:${a.id}`, kind: "appointment" as const, emergency: false, title: `📅 Bagong ${a.service}`, body: `${a.fullName} · ${a.date}` })),
      ...places.data.map((p) => ({ key: `place:${p.id}`, kind: "place" as const, emergency: false, title: "📍 Bagong pin sa Mapa", body: `${p.ownerName}: ${p.name} (${p.category})` })),
      ...borrow.data
        .filter((r) => r.status === "pending")
        .map((r) => ({ key: `borrow:${r.id}`, kind: "borrow" as const, emergency: false, title: "📦 Bagong request sa Hiraman", body: `${r.userName}: ${linesText(r.items)}` })),
      ...borrow.data
        .filter((r) => isLate(r, now))
        .map((r) => ({ key: `borrowLate:${r.id}`, kind: "borrowLate" as const, emergency: false, title: "⏰ Hindi pa naibabalik", body: `${r.userName}: ${linesText(r.items)}` })),
    ];
    const byTab: Record<string, number> = {};
    items.forEach((i) => {
      const tab = PENDING_TAB[i.kind];
      byTab[tab] = (byTab[tab] ?? 0) + 1;
    });
    return {
      items,
      total: items.length,
      byTab,
      loading: places.loading || borrow.loading || amb.loading || listings.loading || posts.loading || jobs.loading || ver.loading || appts.loading,
    };
  }, [isAdmin, amb, listings, posts, jobs, ver, appts, places, borrow, now]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminPending(): Value {
  return useContext(Ctx);
}
