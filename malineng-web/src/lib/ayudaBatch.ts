import { doc, serverTimestamp, writeBatch, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { newEntry, withEntry, type Actor, type TrailEntry } from "@/lib/approval";

/** One release of ayuda to the qualified families of a program. Approved by the steps the Developer set. */
export interface AyudaBatch {
  id: string;
  title: string;
  program: string;
  /** Control numbers (ayuda doc ids) chosen when the batch was made. */
  controlNumbers: string[];
  families: number;
  /** Peso per family, for the record only (no real money is moved). */
  perFamily: number;
  /** Distribution date as written, e.g. "Nob 28". */
  date: string;
  status: "pending" | "approved" | "rejected";
  stage?: number;
  trail?: TrailEntry[];
  urgent?: boolean;
  authorId: string;
  authorName: string;
  rejectReason?: string;
  createdAt?: Timestamp;
}

export const MAX_BATCH_FAMILIES = 400;

/**
 * Last approver releases: every family in the batch that is still "qualified" becomes "scheduled" with the date,
 * then the batch is marked approved. Chunks stay under the 500-write limit; running it again is safe.
 */
export async function releaseAyudaBatch(b: AyudaBatch, actor: Actor, note: string): Promise<void> {
  const stamp = `Naka-schedule sa ${b.date} (${b.title}).`;
  for (let i = 0; i < b.controlNumbers.length; i += 400) {
    const batch = writeBatch(db);
    b.controlNumbers.slice(i, i + 400).forEach((id) => {
      batch.set(doc(db, "ayuda", id), { status: "scheduled", remarks: stamp, updatedAt: serverTimestamp() }, { merge: true });
    });
    await batch.commit();
  }
  const done = writeBatch(db);
  done.update(doc(db, "ayudaBatches", b.id), {
    status: "approved",
    decidedBy: actor.uid,
    decidedByName: actor.name,
    decidedAt: serverTimestamp(),
    trail: withEntry(b.trail, newEntry("release", actor, note)),
    updatedAt: serverTimestamp(),
  });
  await done.commit();
}

export async function rejectAyudaBatch(b: AyudaBatch, actor: Actor, reason: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "ayudaBatches", b.id), {
    status: "rejected",
    rejectReason: reason.slice(0, 300),
    decidedBy: actor.uid,
    decidedByName: actor.name,
    decidedAt: serverTimestamp(),
    trail: withEntry(b.trail, newEntry("reject", actor, reason)),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}
