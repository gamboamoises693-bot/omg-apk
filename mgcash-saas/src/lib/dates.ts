import { Timestamp } from "firebase/firestore";

/** Firestore Timestamp | null -> Date | null. Pending server timestamps read as null. */
export function toDate(t: Timestamp | null | undefined): Date | null {
  return t && typeof t.toDate === "function" ? t.toDate() : null;
}

export function ts(d: Date): Timestamp {
  return Timestamp.fromDate(d);
}
