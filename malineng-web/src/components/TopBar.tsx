"use client";

import Link from "next/link";
import { Phone, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { BARANGAY_CITY } from "@/lib/constants";

export function TopBar() {
  const { isAdmin } = useAuth();
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
            <Link href="/admin" className="rounded-full bg-white/15 p-2" aria-label="Admin">
              <ShieldCheck className="h-6 w-6" />
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
