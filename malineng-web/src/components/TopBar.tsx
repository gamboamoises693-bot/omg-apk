"use client";

import { usePathname } from "next/navigation";
import { BARANGAY_CITY } from "@/lib/constants";
import { AdminShieldLink } from "./AdminShieldLink";
import { PabatidBell } from "./PabatidBell";
import { LogoButton, LogoMark } from "./BarangayLogo";

/** Slim app bar for inner pages. Home draws its own greeting header instead. */
export function TopBar() {
  const pathname = usePathname() ?? "/";
  if (pathname === "/") return null;

  return (
    <header className="no-print sticky top-0 z-40 bg-brand-deep text-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2.5">
        <LogoButton className="flex items-center gap-2">
          <LogoMark />
          <span className="leading-tight">
            <span className="block text-[0.9rem] font-extrabold uppercase tracking-wide">Barangay Malineng</span>
            <span className="block text-[0.7rem] text-white/75">{BARANGAY_CITY}</span>
          </span>
        </LogoButton>
        <div className="flex items-center gap-2">
          <PabatidBell />
          <AdminShieldLink />
        </div>
      </div>
    </header>
  );
}
