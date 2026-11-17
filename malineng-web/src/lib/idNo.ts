import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Barangay ID number: MG-####-#### (8 digits). Each number belongs to one person for good:
 * idNumbers/{8 digits} = { uid } is claimed in the SAME batch that saves users/{uid}.idNo, and the database rules refuse a
 * second claim on a taken number or a change of a number that is already set. So two people can never share one.
 */
export const ID_NO_RE = /^MG-\d{4}-\d{4}$/;

export function formatIdNo(digits: string): string {
  return `MG-${digits.slice(0, 4)}-${digits.slice(4, 8)}`;
}

function randomDigits(): string {
  const n = crypto.getRandomValues(new Uint32Array(2));
  return String((n[0] % 10_000) * 10_000 + (n[1] % 10_000)).padStart(8, "0");
}

/** Gives this person a new ID number (for yourself, or for anyone when you are the Developer). Retries when a number is taken. */
export async function assignIdNo(uid: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    const digits = randomDigits();
    const idNo = formatIdNo(digits);
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "idNumbers", digits), { uid, createdAt: serverTimestamp() });
      batch.update(doc(db, "users", uid), { idNo });
      await batch.commit();
      return idNo;
    } catch (err) {
      lastErr = err; // most likely the number is already taken: try another one
    }
  }
  throw lastErr ?? new Error("Hindi makagawa ng ID number. Subukan ulit.");
}
