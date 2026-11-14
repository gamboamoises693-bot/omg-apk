"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { isMyTurn, stageOf, type Actor, type Approvable } from "@/lib/approval";
import { stepLabel } from "@/lib/approvalConfig";
import { Button } from "@/components/ui";
import { friendlyError } from "@/lib/format";

/**
 * Buttons for the person whose turn it is (Secretary -> Admin -> Kapitan), or a lock message for everyone else.
 * The caller supplies what each action does so Hiraman and Ambulansya can keep their own side effects.
 */
export function ApprovalPanel({
  r,
  steps,
  fastBy,
  onAdvance,
  onReturn,
  onReject,
  onRelease,
  onFast,
  releaseDisabled,
  releaseNote,
  releaseLabel = "I-release",
  canReject = true,
}: {
  r: Approvable;
  /** The approvers the Developer set for this action, in order. */
  steps: string[];
  /** Who may use the emergency release ("Kapitan", "Secretary" or "Kapitan o Secretary"); leave out when it is off. */
  fastBy?: string;
  /** Not the last approver: pass it to the next person. */
  onAdvance: (actor: Actor, note: string) => Promise<void>;
  onReturn: (actor: Actor, note: string) => Promise<void>;
  onReject: (actor: Actor, note: string) => Promise<void>;
  /** The last approver: release (approve). */
  onRelease: (actor: Actor, note: string) => Promise<void>;
  /** Emergency release. Leave out when not applicable. */
  onFast?: (actor: Actor, note: string) => Promise<void>;
  releaseDisabled?: boolean;
  releaseNote?: string;
  /** Text of the last approver's button (e.g. "Approve", "Ready na"). */
  releaseLabel?: string;
  /** Hide "Tanggihan" where rejecting makes no sense (documents). */
  canReject?: boolean;
}) {
  const { user, profile, isSuperAdmin, isAdmin } = useAuth();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const who = { isSuperAdmin, isAdmin, position: profile?.position };
  const s = stageOf(r, steps);
  const last = steps.length - 1;
  const mine = isMyTurn(r, steps, who);
  const fastOk = isSuperAdmin || (isAdmin && !!fastBy && (fastBy === "Kapitan o Secretary" ? ["Kapitan", "Secretary"].includes(profile?.position ?? "") : profile?.position === fastBy));
  const canFast = !!onFast && r.status === "pending" && fastOk;
  const actor: Actor | null = user && profile ? { uid: user.uid, name: profile.fullName, role: isSuperAdmin ? "Developer" : profile.position ?? "Admin" } : null;

  async function run(fn: (a: Actor, n: string) => Promise<void>, needNote: boolean) {
    if (!actor) return;
    if (needNote && !note.trim()) {
      setError("Maglagay muna ng dahilan o paalala.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await fn(actor, note);
      setNote("");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (r.status !== "pending") return null;

  if (!mine) {
    const myIdx = steps.findIndex((st) => !isSuperAdmin && who.isAdmin && (st === "Sinumang Admin" || st === profile?.position));
    const text = myIdx > s ? `Hinihintay pa si ${stepLabel(steps[s])} bago ito mapunta sa iyo.` : myIdx >= 0 && myIdx < s ? "Naipasa mo na ito sa susunod na approver." : `Si ${stepLabel(steps[s])} ang magpapasya rito.`;
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-xs text-gray-600"><Lock className="h-3.5 w-3.5 shrink-0" aria-hidden /> {text}</p>
        {canFast && (
          <Button variant="danger" full loading={busy} onClick={() => confirm("Agarang aprubahan ang request na ito nang hindi na dumadaan sa iba?") && run(onFast!, false)}>
            Agarang aprubahan (emergency)
          </Button>
        )}
        {error && <p className="text-xs text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {isSuperAdmin && <p className="text-[0.7rem] font-bold text-purple-700">DEVELOPER OVERRIDE · ikaw ang kumikilos para kay {stepLabel(steps[s])}</p>}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={releaseNote ?? "Dahilan o paalala (kailangan kung tatanggihan o ibabalik)"}
        aria-label="Paalala"
        rows={2}
        maxLength={300}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        {s >= last ? (
          <Button loading={busy} disabled={releaseDisabled} onClick={() => run(onRelease, false)}>{releaseLabel}</Button>
        ) : (
          <Button loading={busy} onClick={() => run(onAdvance, false)}>{s === 0 ? `I-endorso kay ${stepLabel(steps[s + 1])}` : `Sumang-ayon, ipasa kay ${stepLabel(steps[s + 1])}`}</Button>
        )}
        {canReject ? <Button variant="danger" loading={busy} onClick={() => run(onReject, true)}>Tanggihan</Button> : <span />}
        {s > 0 && <Button variant="outline" loading={busy} className={canFast ? "" : "col-span-2"} onClick={() => run(onReturn, true)}>Ibalik kay {stepLabel(steps[s - 1])}</Button>}
        {canFast && <Button variant="danger" loading={busy} className={s > 0 ? "" : "col-span-2"} onClick={() => confirm("Agarang aprubahan ang request na ito nang hindi na dumadaan sa iba?") && run(onFast!, false)}>Agarang aprubahan</Button>}
      </div>
    </div>
  );
}
