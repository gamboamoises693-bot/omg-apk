import { deleteDoc, doc, getDoc, serverTimestamp, type WriteBatch } from "firebase/firestore";
import { db } from "./firebase";

/**
 * One mobile number = one account.
 * phoneIndex/{09XXXXXXXXX} = { uid } is claimed in the SAME batch that saves users/{uid}.contact;
 * firestore.rules refuse a contact whose index belongs to someone else, and a second
 * claim on a taken number fails, so two accounts can never share a number.
 */

export const PHONE_TAKEN_MESSAGE =
  "May account na ang numerong ito. Mag-login na lang gamit ang account na iyon, o pumunta sa Barangay Hall kung hindi mo ito account.";

/** "+63 917-123-4567", "639171234567", "9171234567" → "09171234567". "" when not a PH mobile number. */
export function normalizePhone(raw: string): string {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.startsWith("63") && d.length === 12) d = `0${d.slice(2)}`;
  else if (d.startsWith("9") && d.length === 10) d = `0${d}`;
  return /^09\d{9}$/.test(d) ? d : "";
}

/** 0917***4567, for showing a number without exposing all of it. */
export function maskPhone(phone: string): string {
  const p = normalizePhone(phone) || phone;
  return p.length >= 11 ? `${p.slice(0, 4)}***${p.slice(-4)}` : p;
}

export type PhoneOwner = "free" | "mine" | "taken";

/** Who holds this number? Reading a taken number's index is refused by the rules, which also means "taken". */
export async function phoneOwner(phone: string, uid: string): Promise<PhoneOwner> {
  try {
    const snap = await getDoc(doc(db, "phoneIndex", phone));
    if (!snap.exists()) return "free";
    return snap.data().uid === uid ? "mine" : "taken";
  } catch (err) {
    if ((err as { code?: string })?.code === "permission-denied") return "taken";
    throw err;
  }
}

/** Adds the claim of `phone` for `uid` to a batch (the batch must also write users/{uid}.contact = phone). */
export function claimPhoneInBatch(batch: WriteBatch, phone: string, uid: string): void {
  batch.set(doc(db, "phoneIndex", phone), { uid, createdAt: serverTimestamp() });
}

/** Releases a number this user holds (number change or account deletion). Never throws. */
export async function releasePhone(phone: string, uid: string): Promise<void> {
  const p = normalizePhone(phone);
  if (!p) return;
  try {
    if ((await phoneOwner(p, uid)) === "mine") await deleteDoc(doc(db, "phoneIndex", p));
  } catch (err) {
    console.warn("[phone] release failed:", err);
  }
}
