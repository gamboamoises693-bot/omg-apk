"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { collection, query, where } from "firebase/firestore";
import { HandHeart } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { notifyNew } from "@/lib/notifyPrefs";
import type { Donation, DonationStatus } from "@/lib/raffleDonations";
import { Modal } from "@/components/ui";

const seenKey = (id: string, status: string) => `malineng-don-seen-${id}-${status}`;
const wasSeen = (id: string, status: string): boolean => {
  try {
    return localStorage.getItem(seenKey(id, status)) === "1";
  } catch {
    return false;
  }
};

const WORDS: Record<Exclude<DonationStatus, "new">, { title: string; push: string }> = {
  accepted: { title: "Natanggap ang pangako mo", push: "Natanggap ng Barangay ang pangako mo. Tatawagan ka namin." },
  received: { title: "Natanggap na ang donasyon mo", push: "Natanggap na ng Barangay ang donasyon mo. Tingnan ang resibo." },
  declined: { title: "Tungkol sa pangako mo", push: "Salamat sa pangako mo. Hindi ito natanggap ngayon." },
};

/**
 * Mounted once in the app shell. Tells a donor what happened to their pledge:
 * - a popup the next time they open the app (once per step), and
 * - a phone notification when the step changes while the app is open.
 */
export function DonationNotifier() {
  const { user } = useAuth();
  const q = useMemo(() => (user ? query(collection(db, "raffleDonations"), where("userId", "==", user.uid)) : null), [user]);
  const { data, loading } = useCollection<Donation>(q);
  const known = useRef<Record<string, string> | null>(null);
  const [, setTick] = useState(0);

  // Phone notification for a change that happens while the app is open (not for what was already there).
  useEffect(() => {
    if (loading) return;
    if (known.current === null) {
      known.current = Object.fromEntries(data.map((d) => [d.id, d.status]));
      return;
    }
    for (const d of data) {
      const before = known.current[d.id];
      known.current[d.id] = d.status;
      if (before !== undefined && before !== d.status && d.status !== "new") {
        notifyNew("donation", `🎁 ${WORDS[d.status].title}`, WORDS[d.status].push, `donation:${d.id}:${d.status}`, "/raffle");
      }
    }
  }, [data, loading]);

  // The popup: the oldest step the person has not seen yet.
  const pending = data.find((d) => d.status !== "new" && !wasSeen(d.id, d.status));
  const close = () => {
    if (!pending) return;
    try {
      localStorage.setItem(seenKey(pending.id, pending.status), "1");
    } catch {
      /* storage blocked: it may show again next time */
    }
    setTick((n) => n + 1);
  };

  if (!pending || pending.status === "new") return null;
  const d = pending;
  return (
    <Modal open onClose={close} title={WORDS[d.status as Exclude<DonationStatus, "new">].title}>
      <div className="space-y-3 text-center">
        <HandHeart className="mx-auto h-10 w-10 text-gold-dark" aria-hidden />
        {d.status === "accepted" && (
          <>
            <p className="text-base font-extrabold">Natanggap na ng Barangay ang pangako mo. Salamat!</p>
            <p className="text-sm text-gray-700">Tatawagan ka ng Barangay sa <b>{d.contact}</b>. Dalhin ang <b>{d.what}</b> sa <b>Barangay Hall</b> at bibigyan ka ng resibo.</p>
          </>
        )}
        {d.status === "received" && (
          <>
            <p className="text-base font-extrabold">Natanggap na ng Barangay ang donasyon mo: {d.what}</p>
            <p className="text-sm text-gray-700">Maraming salamat sa pagtulong! Ang resibo mo ay <b>{d.receiptNo}</b>, at makikita mo ito sa Raffle → Mga donasyon ko.</p>
          </>
        )}
        {d.status === "declined" && <p className="text-sm text-gray-700">Salamat sa pangako mo ({d.what}). Hindi ito natanggap ngayon. Makipag-ugnayan sa Barangay Hall kung may tanong ka.</p>}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/raffle" onClick={close} className="rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-brand">{d.status === "received" ? "Tingnan ang resibo" : "Tingnan ang raffle"}</Link>
          <button onClick={close} className="rounded-xl bg-brand py-2.5 text-sm font-bold text-white active:bg-brand-dark">Sige, salamat</button>
        </div>
      </div>
    </Modal>
  );
}
