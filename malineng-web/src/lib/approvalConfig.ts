"use client";

import { useSyncExternalStore } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Who approves what. The Developer edits this in Admin → Approval (document settings/approvals).
 * Each action has an ordered list of approver positions (1 to 3 steps), can be switched off
 * (then the first approver alone decides), and may allow an emergency "agaran" release.
 */
export type ActionKey = "hiram" | "balik" | "amb" | "ambe" | "ayuda" | "des" | "dok" | "post";

export interface ActionCfg {
  on: boolean;
  steps: string[];
  fast?: boolean;
  fastBy?: string;
}

export type ApprovalConfig = Record<ActionKey, ActionCfg>;

/** Positions an approver step can name. "Sinumang Admin" = any admin except BHW. */
export const APPROVER_OPTIONS = ["Secretary", "Kapitan", "Treasurer", "Kagawad", "SK Chairman", "Sinumang Admin"] as const;
export const FAST_BY_OPTIONS = ["Kapitan", "Secretary", "Kapitan o Secretary"] as const;
export const MAX_STEPS = 3;

export interface ActionDef {
  key: ActionKey;
  name: string;
  ui: string;
  /** Hooked up to the approval engine in the app. The rest are listed for the next versions. */
  wired: boolean;
  hasFast?: boolean;
}

export const ACTION_DEFS: ActionDef[] = [
  { key: "hiram", name: "Hiraman: Request", ui: "Hiraman → Request", wired: true },
  { key: "balik", name: "Hiraman: Pagbabalik ng gamit", ui: "Hiraman → Hiram", wired: true },
  { key: "amb", name: "Ambulansya: Schedule", ui: "Ambulansya", wired: true },
  { key: "ambe", name: "Ambulansya: Emergency", ui: "Ambulansya", wired: true, hasFast: true },
  { key: "ayuda", name: "Ayuda: Paglabas ng ayuda", ui: "Ayuda", wired: true },
  { key: "des", name: "Mahalagang desisyon", ui: "Desisyon", wired: true },
  { key: "dok", name: "Clearance at dokumento", ui: "Dokumento", wired: false },
  { key: "post", name: "Bagong post, paninda, trabaho", ui: "I-approve", wired: false },
];

export const DEFAULT_CONFIG: ApprovalConfig = {
  hiram: { on: true, steps: ["Secretary", "Kapitan"] },
  balik: { on: true, steps: ["Secretary", "Kapitan"] },
  amb: { on: true, steps: ["Secretary", "Kapitan"] },
  ambe: { on: true, steps: ["Secretary", "Kapitan"], fast: true, fastBy: "Kapitan" },
  ayuda: { on: true, steps: ["Secretary", "Kapitan"] },
  des: { on: true, steps: ["Secretary", "Kapitan"] },
  dok: { on: false, steps: ["Secretary"] },
  post: { on: false, steps: ["Sinumang Admin"] },
};

/** The steps that really apply: with approval switched off only the first approver decides. */
export function effectiveSteps(c: ActionCfg): string[] {
  const steps = c.steps.length ? c.steps : ["Kapitan"];
  return c.on ? steps : steps.slice(0, 1);
}

/** "Sinumang Admin" reads as "Admin" in the trackers. */
export const stepLabel = (step: string): string => (step === "Sinumang Admin" ? "Admin" : step);

/** Merges what is stored with the defaults, ignoring anything malformed. */
export function mergeConfig(raw: unknown): ApprovalConfig {
  const out: ApprovalConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  const actions = (raw as { actions?: Record<string, Partial<ActionCfg>> } | undefined)?.actions;
  if (!actions) return out;
  (Object.keys(out) as ActionKey[]).forEach((k) => {
    const a = actions[k];
    if (!a) return;
    const steps = Array.isArray(a.steps) ? a.steps.filter((x): x is string => typeof x === "string").slice(0, MAX_STEPS) : [];
    out[k] = {
      on: a.on !== false,
      steps: steps.length ? steps : out[k].steps,
      ...(k === "ambe" ? { fast: a.fast === true, fastBy: a.fastBy ?? "Kapitan" } : {}),
    };
  });
  return out;
}

/* ---- one shared listener for the whole app ---- */
let current: ApprovalConfig = DEFAULT_CONFIG;
const subscribers = new Set<() => void>();
let unsubscribe: (() => void) | null = null;

function ensureListening(): void {
  if (unsubscribe) return;
  unsubscribe = onSnapshot(
    doc(db, "settings", "approvals"),
    (snap) => {
      current = mergeConfig(snap.exists() ? snap.data() : undefined);
      subscribers.forEach((f) => f());
    },
    () => {},
  );
}

function subscribe(cb: () => void): () => void {
  ensureListening();
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

/** The current approval settings (defaults until loaded). */
export function useApprovalConfig(): ApprovalConfig {
  return useSyncExternalStore(subscribe, () => current, () => DEFAULT_CONFIG);
}
