"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Gift } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { claimEntry, formatWhen, phaseOf, roundsOf, useMyEntry, useNow, useRaffle } from "@/lib/raffle";
import { WinnerQr } from "@/components/WinnerQr";
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
  const { config, rounds, claims } = useRaffle();
  const now = useNow(30_000);
  const entry = useMyEntry(user?.uid);
  const phase = phaseOf(config, rounds.length, now);
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

  // A winner popup (with the QR) the first time a new win is seen on this phone.
  const wins = entry ? rounds.flatMap((r) => r.winners.filter((w) => w.code === entry.code).map((w) => ({ r, w }))) : [];
  const unseenWin = phase === "off" ? undefined : wins.find(({ r, w }) => !wasSeen(`win-${r.round}-${w.code}`) && !claims[`${r.round}_${w.code}`]);
  const closeWin = () => {
    if (!unseenWin) return;
    try {
      localStorage.setItem(seenKey(`win-${unseenWin.r.round}-${unseenWin.w.code}`), "1");
    } catch {
      /* storage blocked: the popup may show again next time */
    }
    setTick((n) => n + 1);
  };
  const [, setTick] = useState(0);

  if (unseenWin && !isStaff) {
    return (
      <Modal open onClose={closeWin} title="🎉 Panalo ka!">
        <div className="space-y-3 text-center">
          <p className="text-lg font-black">Panalo ka ng {unseenWin.w.prize}!</p>
          <p className="text-xs font-bold text-gray-500">{unseenWin.r.type === "maj" ? "MAJOR PRIZE" : unseenWin.r.name} · Round {unseenWin.r.round}</p>
          <div className="mx-auto w-fit rounded-2xl border-2 border-gold bg-white p-2"><WinnerQr round={unseenWin.r.round} code={unseenWin.w.code} /></div>
          <p className="text-sm">Ipakita ang QR na ito sa <b>Barangay Hall</b> kasama ang <b>valid ID</b> mo. Ina-scan ito ng admin para patunayang ikaw ang nanalo.</p>
          <button onClick={closeWin} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white active:bg-brand-dark">Sige, salamat</button>
        </div>
      </Modal>
    );
  }

  if (!open || !entry) return null;
  return (
    <Modal open onClose={close} title="Kasali ka sa raffle!">
      <div className="space-y-3 text-center">
        <Gift className="mx-auto h-10 w-10 text-gold-dark" aria-hidden />
        <p className="text-sm text-gray-700">Salamat sa pagiging verified na taga-Malineng. Ito ang entry number mo sa raffle ng Barangay:</p>
        <p className="mx-auto inline-block rounded-2xl border-2 border-dashed border-gold bg-gold-light px-5 py-3 text-3xl font-black tracking-widest text-brand-deep">{entry.code}</p>
        {roundsOf(config).length > 0 && <p className="text-sm">{roundsOf(config).length > 1 ? `${roundsOf(config).length} na round. Major prize` : "Premyo"}: <b>{roundsOf(config)[roundsOf(config).length - 1].prizes.join(" · ")}</b></p>}
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
