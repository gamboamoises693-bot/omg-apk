"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BARANGAY_CITY } from "@/lib/constants";
import { AdminShieldLink } from "./AdminShieldLink";

/** Slim app bar for inner pages. Home draws its own greeting header instead. */
export function TopBar() {
  const pathname = usePathname() ?? "/";
  if (pathname === "/") return null;

  return (
    <header className="no-print sticky top-0 z-40 bg-brand text-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-sm font-black text-brand-deep">M</span>
          <span className="leading-tight">
            <span className="block text-[0.95rem] font-bold">Barangay Malineng</span>
            <span className="block text-[0.7rem] text-white/75">{BARANGAY_CITY}</span>
          </span>
        </Link>
        <AdminShieldLink />
      </div>
    </header>
  );
}
