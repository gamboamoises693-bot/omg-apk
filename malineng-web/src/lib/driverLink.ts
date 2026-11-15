import { deleteDoc, doc, serverTimestamp, type WriteBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { endTime } from "@/lib/ambulance";
import type { AmbulanceRequest } from "@/lib/types";

/**
 * Ambulance driver link: the driver has no account, so a long random secret in the link is the credential.
 * - `ambulanceDriverLinks/{secret}`: trip details for the driver (readable by id only, never listable).
 * - `ambulanceDriverSecrets/{requestId}`: lets staff copy the link again (admin only).
 * - The request stores only the hash of the secret (`driverTokenHash`), so residents can never learn the secret.
 */

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** 32 random characters from a cryptographically secure source. */
export function newSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // 256 is not a multiple of 36, so reject the biased tail to keep every character equally likely.
  let out = "";
  for (const b of bytes) if (b < 252) out += ALPHABET[b % 36];
  return out.length >= 24 ? out.slice(0, 32) : newSecret();
}

/** UPPERCASE hex SHA-256 (Firestore rules `toHexString()` is uppercase too). */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export const driverUrl = (secret: string): string => `${typeof window !== "undefined" ? window.location.origin : ""}/driver/?t=${secret}`;

/** Link and trip validity: at least 6 hours, or until 24 hours after the trip starts, whichever is later. */
export function linkExpiry(req: Pick<AmbulanceRequest, "date" | "time">): Date {
  const start = new Date(`${req.date}T${req.time}:00`).getTime();
  return new Date(Math.max(Date.now() + 6 * 3600_000, (Number.isFinite(start) ? start : Date.now()) + 24 * 3600_000));
}

/** Adds the writes for a (new) driver link to a batch. Returns the secret and the hash to store on the request. */
export async function addDriverLinkWrites(
  batch: WriteBatch,
  req: AmbulanceRequest,
  driver: string,
  hours: number,
  oldSecret?: string,
  status: "approved" | "enroute" = "approved",
): Promise<{ secret: string; hash: string }> {
  const secret = newSecret();
  const hash = await sha256Hex(secret);
  // The old link stops working as soon as its doc is gone.
  if (oldSecret) batch.delete(doc(db, "ambulanceDriverLinks", oldSecret));
  batch.set(doc(db, "ambulanceDriverLinks", secret), {
    requestId: req.id,
    driver,
    patientName: req.patientName,
    contact: req.contact,
    pickup: req.pickup,
    destination: req.destination || "",
    reason: req.reason,
    type: req.type,
    date: req.date,
    time: req.time,
    endTime: endTime(req.time, hours),
    status,
    expiresAt: linkExpiry(req),
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "ambulanceDriverSecrets", req.id), { secret });
  return { secret, hash };
}

/** Removes a link (trip cancelled or deleted). Failures are ignored: the link is useless without an active request anyway. */
export async function removeDriverLink(secret?: string, requestId?: string): Promise<void> {
  try {
    if (secret) await deleteDoc(doc(db, "ambulanceDriverLinks", secret));
    if (requestId) await deleteDoc(doc(db, "ambulanceDriverSecrets", requestId));
  } catch {
    /* nothing to clean up */
  }
}

