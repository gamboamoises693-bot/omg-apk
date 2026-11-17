"use client";

import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, writeBatch, type Timestamp } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";

/** Pledges of donations for the raffle. The Barangay receives the money or goods at the hall and makes a receipt. */
export type DonationKind = "Pera" | "Gamit / premyo";
export type DonationStatus = "new" | "accepted" | "received" | "declined";

export interface Donation {
  id: string;
  userId: string;
  /** Name or business shown on the sponsor list (unless `anon`). */
  name: string;
  anon: boolean;
  kind: DonationKind;
  /** "₱1,000" for money, or the goods ("20 trays of pandesal"). */
  what: string;
  /** Peso value (0 if it has no value set). Public on the sponsor list, for transparency. */
  amount: number;
  contact: string;
  message: string;
  /** Optional business logo from the donor (small JPEG data URL). It is shown publicly only after the Barangay receives the donation. */
  logo?: string;
  /** Optional Facebook page or website of the donor's business. */
  link?: string;
  /** How the donation reaches the Barangay: the donor brings it to the Barangay Hall, or the Barangay picks it up at their house. Older pledges have none (= Hall). */
  handover?: "hall" | "pickup";
  /** Where to pick it up (only when `handover` is "pickup"). */
  pickupAddress?: string;
  status: DonationStatus;
  receiptNo?: string;
  receivedBy?: string;
  receivedByName?: string;
  receivedAt?: Timestamp;
  note?: string;
  createdAt?: Timestamp;
}

export interface Sponsor {
  id: string;
  name: string;
  what: string;
  amount: number;
  tier: "main" | "reg";
  show: boolean;
  donationId?: string;
  /** Business logo (small JPEG data URL, set by an admin). */
  logo?: string;
  /** Facebook page or website of the business. Tapping the sponsor opens it. */
  link?: string;
  createdAt?: Timestamp;
}

export { linkHost, messengerLink, normalizeLink } from "@/lib/links";
import { normalizeLink } from "@/lib/links";

export const DONATION_STATUS_LABEL: Record<DonationStatus, string> = {
  new: "Bago",
  accepted: "Tinanggap, ihahatid sa Barangay Hall",
  received: "Natanggap na",
  declined: "Hindi tinanggap",
};

/** RAF-20261228-7K2Q: date plus 4 random characters (the receipt for the donor). */
export function newReceiptNo(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `RAF-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

export async function pledgeDonation(uid: string, d: { name: string; anon: boolean; kind: DonationKind; what: string; amount: number; contact: string; message: string; logo?: string; link?: string; handover?: "hall" | "pickup"; pickupAddress?: string }): Promise<void> {
  await setDoc(doc(collection(db, "raffleDonations")), {
    userId: uid,
    name: d.name.trim().slice(0, 120),
    anon: d.anon,
    kind: d.kind,
    what: d.what.trim().slice(0, 120),
    amount: Math.max(0, Math.round(d.amount) || 0),
    contact: d.contact.trim().slice(0, 30),
    message: d.message.trim().slice(0, 300),
    handover: d.handover === "pickup" ? "pickup" : "hall",
    ...(d.handover === "pickup" ? { pickupAddress: (d.pickupAddress ?? "").trim().slice(0, 200) } : {}),
    ...(d.logo && !d.anon ? { logo: d.logo } : {}),
    ...(d.link && !d.anon && normalizeLink(d.link) ? { link: normalizeLink(d.link) } : {}),
    status: "new",
    createdAt: serverTimestamp(),
  });
}

/** The admin received the money or goods: makes the receipt and puts the donor on the sponsor list. */
export async function markReceived(d: Donation, actor: { uid: string; name: string }, amount: number, what: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "raffleDonations", d.id), {
    status: "received",
    receiptNo: newReceiptNo(),
    receivedBy: actor.uid,
    receivedByName: actor.name,
    receivedAt: serverTimestamp(),
    amount: Math.max(0, Math.round(amount) || 0),
    what: what.trim().slice(0, 120) || d.what,
  });
  batch.set(doc(db, "raffleSponsors", d.id), {
    name: d.anon ? "Hindi nagpakilala" : d.name,
    what: what.trim().slice(0, 120) || d.what,
    amount: Math.max(0, Math.round(amount) || 0),
    tier: "reg",
    show: true,
    donationId: d.id,
    // Anonymous donors never get a logo on the list.
    ...(d.logo && !d.anon ? { logo: d.logo } : {}),
    ...(d.link && !d.anon ? { link: d.link } : {}),
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

/** Public sponsor list (shown ones first as the page decides). */
export function useSponsors(): { sponsors: Sponsor[]; loading: boolean } {
  const [list, setList] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const q = useMemo(() => query(collection(db, "raffleSponsors"), orderBy("createdAt", "desc")), []);
  useEffect(
    () =>
      onSnapshot(
        q,
        (snap) => {
          setList(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Sponsor));
          setLoading(false);
        },
        () => setLoading(false),
      ),
    [q],
  );
  return { sponsors: list, loading };
}
