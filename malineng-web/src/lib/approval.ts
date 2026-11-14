import { doc, updateDoc, serverTimestamp, type DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { stepLabel } from "@/lib/approvalConfig";

/**
 * Approval by steps, as set by the Developer in Admin → Approval (see approvalConfig.ts).
 * While a request is still `status: "pending"`, `stage` is the index of the step whose turn it is.
 * Documents made before this existed have no `stage`, which counts as 0.
 * `trail` is an append-only log that the resident can read.
 * The Developer (Super Admin) can act at any stage and always has the emergency release.
 */

export type TrailStep = "endorse" | "agree" | "release" | "reject" | "return" | "fast" | "override" | "handback" | "accept" | "resident";

export interface TrailEntry {
  step: TrailStep;
  /** uid of the person. */
  by: string;
  name: string;
  /** "Secretary", "Kapitan", "Treasurer"... or "Developer". */
  role: string;
  /** ISO time. */
  at: string;
  note: string;
}

export interface Approvable {
  status: string;
  stage?: number;
  trail?: TrailEntry[];
  urgent?: boolean;
}

export interface Actor {
  uid: string;
  name: string;
  /** Position text ("Secretary"...) or "Developer". */
  role: string;
}

/** The step the request is at, kept inside the configured list. */
export const stageOf = (r: Approvable, steps: string[]): number => Math.min(Math.max(0, r.stage ?? 0), Math.max(0, steps.length - 1));

export interface Who {
  isSuperAdmin: boolean;
  isAdmin: boolean;
  position?: string;
}

/** Does this person decide at that step? The Developer always does. "Sinumang Admin" = any admin except BHW. */
export function matchesStep(step: string, who: Who): boolean {
  if (who.isSuperAdmin) return true;
  return who.isAdmin && (step === "Sinumang Admin" || who.position === step);
}

export function isMyTurn(r: Approvable, steps: string[], who: Who): boolean {
  return r.status === "pending" && matchesStep(steps[stageOf(r, steps)] ?? "", who);
}

/** "Hinihintay si Secretary" / "Hinihintay si Kapitan" */
export function waitingLabel(r: Approvable, steps: string[]): string {
  if (r.status !== "pending") return "";
  return `Hinihintay si ${stepLabel(steps[stageOf(r, steps)] ?? "Kapitan")}`;
}

const STEP_TEXT: Record<TrailStep, string> = {
  endorse: "Inendorso ni",
  agree: "Sumang-ayon si",
  release: "Inilabas ni",
  reject: "Tinanggihan ni",
  return: "Ibinalik ni",
  fast: "AGARANG inaprubahan ni",
  override: "Override ni",
  handback: "Ibinalik sa residente ni",
  accept: "Tinanggap ni",
  resident: "Ibinalik ng",
};

export function trailLine(t: TrailEntry): string {
  const when = new Date(t.at).toLocaleString("fil-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return `${when} · ${STEP_TEXT[t.step]} ${t.role === "Developer" ? "Developer" : t.role}${t.note ? `: "${t.note}"` : ""}`;
}

export function newEntry(step: TrailStep, actor: Actor, note: string): TrailEntry {
  return { step, by: actor.uid, name: actor.name, role: actor.role, at: new Date().toISOString(), note: note.trim().slice(0, 300) };
}

/** Appends to a trail (the rules require exactly one new entry per change). */
export const withEntry = (trail: TrailEntry[] | undefined, entry: TrailEntry): TrailEntry[] => [...(trail ?? []), entry];

/** Moves a pending request one step forward. */
export async function advanceRequest(collectionName: string, id: string, r: Approvable, steps: string[], actor: Actor, note: string, extra: DocumentData = {}): Promise<void> {
  const s = stageOf(r, steps);
  if (s >= steps.length - 1) throw new Error("Nasa huling approver na ang request.");
  await updateDoc(doc(db, collectionName, id), { ...extra, stage: s + 1, trail: withEntry(r.trail, newEntry(s === 0 ? "endorse" : "agree", actor, note)), updatedAt: serverTimestamp() });
}

/** Sends a pending request back one step, with the reason. */
export async function returnRequest(collectionName: string, id: string, r: Approvable, steps: string[], actor: Actor, note: string): Promise<void> {
  const s = stageOf(r, steps);
  if (s === 0) throw new Error("Nasa unang hakbang na ito.");
  await updateDoc(doc(db, collectionName, id), { stage: s - 1, trail: withEntry(r.trail, newEntry("return", actor, note)), updatedAt: serverTimestamp() });
}
