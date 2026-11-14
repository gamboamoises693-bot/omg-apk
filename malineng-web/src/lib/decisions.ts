import { doc, serverTimestamp, writeBatch, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { newEntry, withEntry, type Actor, type TrailEntry } from "@/lib/approval";


/** Kinds of important decisions. */
export const DECISION_KINDS = ["Gastusin", "Proyekto", "Patakaran", "Iba pa"] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];

/**
 * Private working copy, with the amount: decisions/{id}. Only admins read it.
 * Residents read the public copy decisionsPublic/{id}, which has NO amount and exists only after the last approver releases.
 */
export interface Decision {
  id: string;
  title: string;
  kind: DecisionKind;
  /** Peso amount, 0 if none. Admin-only. */
  amount: number;
  detail: string;
  status: "pending" | "approved" | "rejected";
  stage?: number;
  trail?: TrailEntry[];
  urgent?: boolean;
  authorId: string;
  authorName: string;
  rejectReason?: string;
  createdAt?: Timestamp;
}

export interface PublicDecision {
  id: string;
  title: string;
  kind: DecisionKind;
  detail: string;
  decidedAt?: Timestamp;
}

/** Last approver releases: marks it approved and publishes the amount-free copy in one batch. */
export async function releaseDecision(d: Decision, actor: Actor, note: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "decisions", d.id), {
    status: "approved",
    decidedBy: actor.uid,
    decidedByName: actor.name,
    decidedAt: serverTimestamp(),
    trail: withEntry(d.trail, newEntry("release", actor, note)),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, "decisionsPublic", d.id), { title: d.title, kind: d.kind, detail: d.detail, decidedAt: serverTimestamp() });
  await batch.commit();
}

export async function rejectDecision(d: Decision, actor: Actor, reason: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "decisions", d.id), {
    status: "rejected",
    rejectReason: reason.slice(0, 300),
    decidedBy: actor.uid,
    decidedByName: actor.name,
    decidedAt: serverTimestamp(),
    trail: withEntry(d.trail, newEntry("reject", actor, reason)),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}
