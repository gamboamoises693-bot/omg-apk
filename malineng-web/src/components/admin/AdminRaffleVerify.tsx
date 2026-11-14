"use client";

import Link from "next/link";
import { ScanLine } from "lucide-react";

/** Admin shortcut: the verify page is where a winner's QR is checked and the prize is handed over. */
export function AdminRaffleVerify() {
  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-brand-deep p-3 text-sm text-white">
        Para sa pagbibigay ng premyo: i-scan ang <b className="text-gold">QR ng nanalo</b> (gamit ang scanner sa pahina o ang camera ng phone). Titingnan ng app kung totoong nanalo, ipapakita ang buong pangalan at premyo, at itatala kapag naibigay na.
      </p>
      <Link href="/raffle/verify" className="flex items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-white">
        <ScanLine className="h-5 w-5" aria-hidden /> Buksan ang scanner
      </Link>
    </div>
  );
}
