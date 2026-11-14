import { doc, updateDoc, serverTimestamp, type DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Three-step approval used by Hiraman and Ambulansya (and later Ayuda / important decisions):
 *   stage 0  Secretary reviews  ->  stage 1  Admin agrees  ->  stage 2  Kapitan releases.
 * While a request is still `status: "pending"`, `stage` says whose turn it is. Documents made before
 * this existed have no `stage`, which counts as 0. `trail` is an append-only log that the resident can read.
 * The Developer (Super Admin) can act at any stage; Kapitan (or the Developer) can use the emergency "agaran" release.
 */
export const STAGE_NAMES = ["Secretary", "Admin", "Kapitan"] as const;
export type StageIndex = 0 | 1 | 2;

export type TrailStep = "endorse" | "agree" | "release" | "reject" | "return" | "fast" | "override";

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

export const stageOf = (r: Approvable): StageIndex => (Math.min(2, Math.max(0, r.stage ?? 0)) as StageIndex);

/** Which stage this person decides at. The Developer can act at whatever stage the request is at. */
export function roleStage(opts: { isSuperAdmin: boolean; isAdmin: boolean; position?: string }): StageIndex | "any" | null {
  if (opts.isSuperAdmin) return "any";
  if (!opts.isAdmin) return null;
  if (opts.position === "Secretary") return 0;
  if (opts.position === "Kapitan") return 2;
  return 1;
}

export function isMyTurn(r: Approvable, role: ReturnType<typeof roleStage>): boolean {
  return r.status === "pending" && role !== null && (role === "any" || role === stageOf(r));
}

/** "Hinihintay si Secretary" / "Hinihintay si Admin" / "Hinihintay si Kapitan" */
export function waitingLabel(r: Approvable): string {
  if (r.status !== "pending") return "";
  return `Hinihintay si ${STAGE_NAMES[stageOf(r)]}`;
}

const STEP_TEXT: Record<TrailStep, string> = {
  endorse: "Inendorso ni",
  agree: "Sumang-ayon si",
  release: "Inilabas ni",
  reject: "Tinanggihan ni",
  return: "Ibinalik ni",
  fast: "AGARANG inaprubahan ni",
  override: "Override ni",
};

export function trailLine(t: TrailEntry): string {
  const when = new Date(t.at).toLocaleString("fil-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return `${when} · ${STEP_TEXT[t.step]} ${t.role === "Developer" ? "Developer" : t.role}${t.note ? `: "${t.note}"` : ""}`;
}

export function newEntry(step: TrailStep, actor: Actor, note: string): TrailEntry {
  return { step, by: actor.uid, name: actor.name, role: actor.role, at: new Date().toISOString(), note: note.trim().slice(0, 300) };
}

/** Appends to the trail (the rules require exactly one new entry per change). */
export const withEntry = (r: Approvable, entry: TrailEntry): TrailEntry[] => [...(r.trail ?? []), entry];

/** Moves a pending request one step forward (Secretary -> Admin -> Kapitan). */
export async function advanceRequest(collectionName: string, id: string, r: Approvable, actor: Actor, note: string, extra: DocumentData = {}): Promise<void> {
  const s = stageOf(r);
  if (s >= 2) throw new Error("Nasa Kapitan na ang request.");
  const step: TrailStep = s === 0 ? "endorse" : "agree";
  await updateDoc(doc(db, collectionName, id), { ...extra, stage: s + 1, trail: withEntry(r, newEntry(step, actor, note)), updatedAt: serverTimestamp() });
}

/** Sends a pending request back one step, with the reason. */
export async function returnRequest(collectionName: string, id: string, r: Approvable, actor: Actor, note: string): Promise<void> {
  const s = stageOf(r);
  if (s === 0) throw new Error("Nasa unang hakbang na ito.");
  await updateDoc(doc(db, collectionName, id), { stage: s - 1, trail: withEntry(r, newEntry("return", actor, note)), updatedAt: serverTimestamp() });
}
