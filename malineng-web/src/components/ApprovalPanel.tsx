"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { STAGE_NAMES, isMyTurn, roleStage, stageOf, type Actor, type Approvable } from "@/lib/approval";
import { Button } from "@/components/ui";
import { friendlyError } from "@/lib/format";

/**
 * Buttons for the person whose turn it is (Secretary -> Admin -> Kapitan), or a lock message for everyone else.
 * The caller supplies what each action does so Hiraman and Ambulansya can keep their own side effects.
 */
export function ApprovalPanel({
  r,
  onAdvance,
  onReturn,
  onReject,
  onRelease,
  onFast,
  releaseDisabled,
  releaseNote,
}: {
  r: Approvable;
  /** Secretary / Admin: pass it to the next person. */
  onAdvance: (actor: Actor, note: string) => Promise<void>;
  onReturn: (actor: Actor, note: string) => Promise<void>;
  onReject: (actor: Actor, note: string) => Promise<void>;
  /** Kapitan: release (approve). */
  onRelease: (actor: Actor, note: string) => Promise<void>;
  /** Emergency: Kapitan or Developer approves at once. Leave out when not applicable. */
  onFast?: (actor: Actor, note: string) => Promise<void>;
  releaseDisabled?: boolean;
  releaseNote?: string;
}) {
  const { user, profile, isSuperAdmin, isAdmin } = useAuth();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const role = roleStage({ isSuperAdmin, isAdmin, position: profile?.position });
  const s = stageOf(r);
  const mine = isMyTurn(r, role);
  const canFast = !!onFast && r.status === "pending" && (isSuperAdmin || (isAdmin && profile?.position === "Kapitan"));
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
    const myStage = role === null || role === "any" ? -1 : role;
    const text = myStage >= 0 && s < myStage ? `Hinihintay pa si ${STAGE_NAMES[s]} bago ito mapunta sa iyo.` : `Naipasa na sa susunod: ${STAGE_NAMES[s]} ang magpapasya.`;
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
      {isSuperAdmin && <p className="text-[0.7rem] font-bold text-purple-700">DEVELOPER OVERRIDE · ikaw ang kumikilos para kay {STAGE_NAMES[s]}</p>}
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
        {s === 2 ? (
          <Button loading={busy} disabled={releaseDisabled} onClick={() => run(onRelease, false)}>I-release</Button>
        ) : (
          <Button loading={busy} onClick={() => run(onAdvance, false)}>{s === 0 ? "I-endorso kay Admin" : "Sumang-ayon, ipasa kay Kapitan"}</Button>
        )}
        <Button variant="danger" loading={busy} onClick={() => run(onReject, true)}>Tanggihan</Button>
        {s > 0 && <Button variant="outline" loading={busy} className={canFast ? "" : "col-span-2"} onClick={() => run(onReturn, true)}>Ibalik kay {STAGE_NAMES[s - 1]}</Button>}
        {canFast && <Button variant="danger" loading={busy} className={s > 0 ? "" : "col-span-2"} onClick={() => confirm("Agarang aprubahan ang request na ito nang hindi na dumadaan sa iba?") && run(onFast!, false)}>Agarang aprubahan</Button>}
      </div>
    </div>
  );
}
