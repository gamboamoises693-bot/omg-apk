"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { arrayRemove, arrayUnion, deleteField } from "firebase/firestore";
import { ThumbsUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { friendlyError } from "@/lib/format";
import { REACTIONS, REACTION_BY_KEY, isReactionKey, type ReactionKey } from "@/lib/reactions";
import { Modal } from "./ui";
import { useToast } from "./Toast";

/** Field changes for a Firestore document that stores `likes` (uids) and `reactions` (uid -> key). */
export function reactionPatch(uid: string, key: ReactionKey | null): Record<string, unknown> {
  return key
    ? { likes: arrayUnion(uid), [`reactions.${uid}`]: key }
    : { likes: arrayRemove(uid), [`reactions.${uid}`]: deleteField() };
}

interface Options {
  likes: string[];
  reactions?: Record<string, string>;
  /** Writes the change; throws on failure. */
  save: (uid: string, key: ReactionKey | null) => Promise<void>;
}

/** Shared reaction logic for posts and videos: tap = 👍, hold = choose, same again = remove. */
export function useReactions({ likes, reactions, save }: Options) {
  const { user } = useAuth();
  const toast = useToast();
  const [pop, setPop] = useState(false);
  const [tray, setTray] = useState(false);
  const [summary, setSummary] = useState(false);
  // Show the tap immediately. undefined = nothing pending, null = removed, string = chosen.
  const [optimistic, setOptimistic] = useState<ReactionKey | null | undefined>(undefined);
  const holdTimer = useRef<number | null>(null);
  const heldOpen = useRef(false);

  // Older likes (no entry in `reactions`) count as 👍.
  const reactionMap = useMemo(() => {
    const map: Record<string, ReactionKey> = {};
    for (const uid of likes) map[uid] = "like";
    for (const [uid, key] of Object.entries(reactions ?? {})) if (isReactionKey(key)) map[uid] = key;
    if (user && optimistic !== undefined) {
      if (optimistic === null) delete map[user.uid];
      else map[user.uid] = optimistic;
    }
    return map;
  }, [likes, reactions, optimistic, user]);

  const mine: ReactionKey | null = (user && reactionMap[user.uid]) || null;
  const counts = useMemo(() => {
    const c: Partial<Record<ReactionKey, number>> = {};
    Object.values(reactionMap).forEach((k) => (c[k] = (c[k] ?? 0) + 1));
    return c;
  }, [reactionMap]);
  const total = Object.keys(reactionMap).length;
  const topKeys = REACTIONS.map((r) => r.key)
    .filter((k) => (counts[k] ?? 0) > 0)
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
    .slice(0, 3);

  useEffect(() => setOptimistic(undefined), [likes, reactions]);

  const react = async (key: ReactionKey) => {
    if (!user) {
      toast("Mag-login muna para mag-react.", "error");
      return;
    }
    setTray(false);
    const remove = mine === key;
    setOptimistic(remove ? null : key);
    if (!remove) {
      setPop(true);
      setTimeout(() => setPop(false), 350);
    }
    try {
      await save(user.uid, remove ? null : key);
    } catch (err) {
      setOptimistic(undefined);
      toast(friendlyError(err), "error");
    }
  };

  const startHold = () => {
    heldOpen.current = false;
    holdTimer.current = window.setTimeout(() => {
      heldOpen.current = true;
      setTray(true);
    }, 380);
  };
  const endHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  /** Called by the button's click: a hold that opened the tray must not also react. */
  const tap = () => {
    if (heldOpen.current) {
      heldOpen.current = false;
      return;
    }
    react(mine ?? "like");
  };

  return { mine, counts, total, topKeys, pop, tray, setTray, summary, setSummary, react, startHold, endHold, tap };
}
export type Reactions = ReturnType<typeof useReactions>;

/** "👍❤️ 12": opens the breakdown. */
export function ReactionCounts({ r }: { r: Reactions }) {
  return r.total > 0 ? (
    <button type="button" onClick={() => r.setSummary(true)} className="flex items-center gap-1.5 active:opacity-70" aria-label={`${r.total} reaction. Tingnan ang detalye`}>
      <span className="flex -space-x-1.5">
        {r.topKeys.map((k) => (
          <span key={k} className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[0.8rem] leading-none ring-2 ring-white">{REACTION_BY_KEY[k].emoji}</span>
        ))}
      </span>
      {r.total.toLocaleString("en-PH")}
    </button>
  ) : (
    <span className="text-xs">Maging una sa pag-react</span>
  );
}

/** The Like button with the hold-to-choose tray. */
export function LikeButton({ r }: { r: Reactions }) {
  const { mine } = r;
  return (
    <div className="relative flex-1">
      {r.tray && (
        <>
          <button type="button" aria-label="Isara ang mga reaction" className="fixed inset-0 z-30 cursor-default" onClick={() => r.setTray(false)} />
          <div className="absolute bottom-full left-0 z-40 mb-2 flex gap-1 rounded-full bg-white px-2 py-1.5 shadow-float ring-1 ring-gray-100" role="menu" aria-label="Pumili ng reaction">
            {REACTIONS.map((x) => (
              <button key={x.key} type="button" role="menuitem" onClick={() => r.react(x.key)} aria-label={x.label} title={x.label} className={`rounded-full px-1 text-[1.7rem] leading-none transition-transform active:scale-125 ${mine === x.key ? "scale-110 bg-brand-light" : ""}`}>
                {x.emoji}
              </button>
            ))}
          </div>
        </>
      )}
      <button
        type="button"
        onPointerDown={r.startHold}
        onPointerUp={r.endHold}
        onPointerLeave={r.endHold}
        onPointerCancel={r.endHold}
        onContextMenu={(e) => e.preventDefault()}
        onClick={r.tap}
        aria-pressed={!!mine}
        aria-label={mine ? `${REACTION_BY_KEY[mine].label}. Pindutin para alisin, o pindutin nang matagal para palitan` : "Like. Pindutin nang matagal para sa ibang reaction"}
        className={`flex w-full select-none items-center justify-center gap-2 rounded-xl py-2.5 text-[0.95rem] font-semibold active:bg-gray-100 ${mine ? REACTION_BY_KEY[mine].color : "text-gray-600"}`}
        style={{ WebkitTouchCallout: "none" }}
      >
        {mine ? <span className={`text-xl leading-none ${r.pop ? "animate-like-pop" : ""}`}>{REACTION_BY_KEY[mine].emoji}</span> : <ThumbsUp className="h-5 w-5" />}
        {mine ? REACTION_BY_KEY[mine].label : "Like"}
      </button>
    </div>
  );
}

export function ReactionSummary({ r }: { r: Reactions }) {
  return (
    <Modal open={r.summary} onClose={() => r.setSummary(false)} title="Mga reaction">
      <ul className="divide-y divide-gray-100">
        {REACTIONS.filter((x) => (r.counts[x.key] ?? 0) > 0).map((x) => (
          <li key={x.key} className="flex items-center gap-3 py-2.5">
            <span className="text-2xl">{x.emoji}</span>
            <span className="flex-1 font-semibold">{x.label}</span>
            <span className="font-bold text-gray-700">{r.counts[x.key]}</span>
          </li>
        ))}
      </ul>
      {r.total === 0 && <p className="text-sm text-gray-600">Wala pang reaction.</p>}
    </Modal>
  );
}
