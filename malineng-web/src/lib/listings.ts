import { Timestamp, collection, deleteDoc, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { Listing } from "./types";

/** A listing is visible for 24 hours after approval, then hidden. */
export const LISTING_DURATION_HOURS = 24;
/** Hidden listings are deleted from the database this many hours after they expire (time to "I-post ulit"). */
export const LISTING_DELETE_GRACE_HOURS = 24;

const HOUR = 60 * 60 * 1000;

export function newExpiry(): Timestamp {
  return Timestamp.fromMillis(Date.now() + LISTING_DURATION_HOURS * HOUR);
}

export function isExpired(l: Pick<Listing, "expiresAt">): boolean {
  return !!l.expiresAt && l.expiresAt.toMillis() <= Date.now();
}

/** Expired listings old enough to remove from the database. */
export function deleteCutoff(): Timestamp {
  return Timestamp.fromMillis(Date.now() - LISTING_DELETE_GRACE_HOURS * HOUR);
}

/** "12 oras na lang" style label. */
export function timeLeft(l: Pick<Listing, "expiresAt">): string {
  if (!l.expiresAt) return "";
  const ms = l.expiresAt.toMillis() - Date.now();
  if (ms <= 0) return "Expired na";
  const h = Math.floor(ms / HOUR);
  if (h >= 1) return `${h} oras na lang`;
  return `${Math.max(1, Math.floor(ms / 60000))} minuto na lang`;
}

/** Deletes a listing and its full-size photo document. */
export async function deleteListing(id: string): Promise<void> {
  await deleteDoc(doc(db, "listings", id));
  await deleteDoc(doc(db, "listingPhotos", id)).catch(() => undefined);
}

/**
 * "I-post ulit": creates a fresh pending copy (new 24 hours after approval)
 * and removes the expired one. Requires a verified seller (firestore.rules).
 */
export async function repostListing(old: Listing): Promise<string> {
  const fresh = doc(collection(db, "listings"));
  const photoSnap = await getDoc(doc(db, "listingPhotos", old.id)).catch(() => null);
  const batch = writeBatch(db);
  batch.set(fresh, {
    sellerId: old.sellerId,
    sellerName: old.sellerName,
    title: old.title,
    price: old.price,
    category: old.category,
    description: old.description,
    photoURL: old.photoURL,
    contact: old.contact,
    messengerLink: old.messengerLink,
    purok: old.purok,
    status: "pending",
    expiresAt: newExpiry(),
    createdAt: serverTimestamp(),
  });
  if (photoSnap?.exists()) {
    batch.set(doc(db, "listingPhotos", fresh.id), { sellerId: old.sellerId, photo: photoSnap.data().photo, createdAt: serverTimestamp() });
  }
  await batch.commit();
  await deleteListing(old.id).catch(() => undefined);
  return fresh.id;
}
