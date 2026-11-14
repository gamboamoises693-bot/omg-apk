"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Gift } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { claimEntry, formatWhen, phaseOf, useMyEntry, useNow, useRaffle } from "@/lib/raffle";
import { Modal } from "@/components/ui";

const seenKey = (code: string) => `malineng-raffle-seen-${code}`;
const wasSeen = (code: string): boolean => {
  try {
    return localStorage.getItem(seenKey(code)) === "1";
  } catch {
    return false;
  }
};

/**
 * Mounted once in the app shell, so it works on whatever page a person opens first.
 * - A verified resident (even one who registered long before the raffle) gets their entry automatically
 *   while entries are open, as soon as they open the app.
 * - Then a popup shows the entry code once on this phone (it stays on the Home card and the Raffle page).
 */
export function RaffleEntryManager() {
  const { user, profile, isVerified, isStaff } = useAuth();
  const { config, pub } = useRaffle();
  const now = useNow(30_000);
  const entry = useMyEntry(user?.uid);
  const phase = phaseOf(config, pub, now);
  const tried = useRef(false);
  const [open, setOpen] = useState(false);

  // Give the entry (the rules check verified, not staff, and the open window).
  useEffect(() => {
    if (tried.current || !user || !profile || !isVerified || isStaff || phase !== "open" || entry !== null) return;
    tried.current = true;
    claimEntry(user.uid, profile.fullName, profile.purok ?? "").catch(() => {
      tried.current = false; // try again on the next change (e.g. a slow connection)
    });
  }, [user, profile, isVerified, isStaff, phase, entry]);

  // Show the code once per entry on this device.
  useEffect(() => {
    if (!entry || isStaff || (phase !== "open" && phase !== "closed")) return;
    if (!wasSeen(entry.code)) setOpen(true);
  }, [entry, isStaff, phase]);

  const close = () => {
    if (entry) {
      try {
        localStorage.setItem(seenKey(entry.code), "1");
      } catch {
        /* storage blocked: the popup may show again next time */
      }
    }
    setOpen(false);
  };

  if (!open || !entry) return null;
  return (
    <Modal open onClose={close} title="Kasali ka sa raffle!">
      <div className="space-y-3 text-center">
        <Gift className="mx-auto h-10 w-10 text-gold-dark" aria-hidden />
        <p className="text-sm text-gray-700">Salamat sa pagiging verified na taga-Malineng. Ito ang entry number mo sa raffle ng Barangay:</p>
        <p className="mx-auto inline-block rounded-2xl border-2 border-dashed border-gold bg-gold-light px-5 py-3 text-3xl font-black tracking-widest text-brand-deep">{entry.code}</p>
        {config?.prize && <p className="text-sm">Premyo: <b>{config.prize}</b></p>}
        <p className="text-xs text-gray-500">
          {phase === "open" ? `Cutoff ng entries: ${formatWhen(config?.cutoffAt)}.` : `Sarado na ang entries. Bunutan: ${formatWhen(config?.drawAt)}.`} Makikita mo ulit ang number sa Home at sa pahinang Raffle.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/raffle" onClick={close} className="rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-brand">Tingnan ang raffle</Link>
          <button onClick={close} className="rounded-xl bg-brand py-2.5 text-sm font-bold text-white active:bg-brand-dark">Sige, salamat</button>
        </div>
      </div>
    </Modal>
  );
}
