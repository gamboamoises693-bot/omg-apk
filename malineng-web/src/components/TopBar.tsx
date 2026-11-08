"use client";

import Link from "next/link";
import { Phone, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { collection, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { BARANGAY_CITY } from "@/lib/constants";

export function TopBar() {
  const { isAdmin } = useAuth();
  // Admin-only live count of new ambulance requests, shown as a red badge on the shield.
  const pendingQ = useMemo(() => (isAdmin ? query(collection(db, "ambulanceRequests"), where("status", "==", "pending")) : null), [isAdmin]);
  const { data: pending } = useCollection<{ id: string }>(pendingQ);
  return (
    <header className="sticky top-0 z-40 bg-brand text-white shadow">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-lg font-black text-brand-dark">M</span>
          <span className="leading-tight">
            <span className="block text-lg font-bold">Barangay Malineng</span>
            <span className="block text-xs text-white/80">{BARANGAY_CITY}</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link href="/admin" className="relative rounded-full bg-white/15 p-2" aria-label={pending.length ? `Admin, ${pending.length} bagong ambulance request` : "Admin"}>
              <ShieldCheck className="h-6 w-6" />
              {pending.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-black ring-2 ring-brand">
                  {pending.length}
                </span>
              )}
            </Link>
          )}
          <Link href="/emergency" className="flex items-center gap-1 rounded-full bg-red-600 px-3 py-2 text-sm font-bold" aria-label="Emergency">
            <Phone className="h-4 w-4" /> SOS
          </Link>
        </div>
      </div>
    </header>
  );
}
