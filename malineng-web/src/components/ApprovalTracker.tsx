import { Check, X } from "lucide-react";
import { stageOf, trailLine, type Approvable, type TrailEntry } from "@/lib/approval";
import { stepLabel } from "@/lib/approvalConfig";

const DONE_TEXT = ["Inendorso", "Sumang-ayon", "Sumang-ayon"] as const;

/**
 * The step tracker (the approvers the Developer set) plus the log of who did what.
 * Shown to residents too, so they can see whose turn it is.
 * `done` marks a finished request (released or closed); a rejected one shows the step that said no.
 * `firstLabel` is the always-done first dot ("Isinumite" for requests, "Ibinalik" for returns).
 */
export function ApprovalTracker({
  r,
  steps,
  showLog = true,
  dark = false,
  firstLabel = "Isinumite",
  trail,
}: {
  r: Approvable;
  steps: string[];
  showLog?: boolean;
  /** On a navy card (resident Hiraman card). */
  dark?: boolean;
  firstLabel?: string;
  /** Use another log (e.g. the return log) instead of r.trail. */
  trail?: TrailEntry[];
}) {
  const s = stageOf(r, steps);
  const released = r.status !== "pending" && r.status !== "rejected" && r.status !== "cancelled";
  const rejStage = r.status === "rejected" ? s : -1;
  const log = trail ?? r.trail ?? [];
  const lastLabel = (i: number) => (i === steps.length - 1 ? "Inilabas" : DONE_TEXT[Math.min(i, 2)]);
  const nowLabel = (i: number) => (i === steps.length - 1 ? "Magpapasya" : i === 0 ? "Sumusuri" : "Sumasang-ayon");
  const rejectedAt = r.status === "rejected" ? [...log].reverse().find((t) => t.step === "reject") : undefined;

  return (
    <div className="space-y-2">
      <ol className="grid gap-1 text-center" style={{ gridTemplateColumns: `repeat(${steps.length + 1}, minmax(0, 1fr))` }} aria-label="Takbo ng approval">
        <li className="flex min-w-0 flex-col items-center gap-0.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-white"><Check className="h-4 w-4" aria-hidden /></span>
          <span className={`text-[0.7rem] font-bold ${dark ? "text-white" : ""}`}>{firstLabel}</span>
        </li>
        {steps.map((name, i) => {
          const state = released || (r.status === "pending" && i < s) ? "done" : r.status === "pending" && i === s ? "now" : r.status === "rejected" && i === rejStage ? "bad" : r.status === "rejected" && i < rejStage ? "done" : "wait";
          return (
            <li key={`${name}-${i}`} className="flex min-w-0 flex-col items-center gap-0.5">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${
                  state === "done" ? "bg-green-600 text-white" : state === "now" ? "bg-gold text-brand-deep ring-4 ring-gold/30" : state === "bad" ? "bg-red-600 text-white" : dark ? "border-2 border-white/40 text-white/60" : "border-2 border-gray-300 text-gray-400"
                }`}
              >
                {state === "done" ? <Check className="h-4 w-4" aria-hidden /> : state === "bad" ? <X className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              <span className={`text-[0.7rem] font-bold ${dark ? "text-white" : ""}`}>{stepLabel(name)}</span>
              <span className={`text-[0.62rem] leading-tight ${dark ? "text-white/70" : "text-gray-500"}`}>{state === "done" ? lastLabel(i) : state === "now" ? nowLabel(i) : state === "bad" ? "Tinanggihan" : "Susunod"}</span>
            </li>
          );
        })}
      </ol>
      {showLog && log.length > 0 && (
        <ul className={`space-y-0.5 rounded-xl p-2.5 text-xs ${dark ? "bg-white/10 text-white/85" : "bg-surface text-gray-600"}`}>
          {log.map((t, i) => (
            <li key={i}>{trailLine(t)}</li>
          ))}
        </ul>
      )}
      {rejectedAt && !rejectedAt.note && <p className={`text-xs ${dark ? "text-red-200" : "text-red-700"}`}>Tinanggihan ni {rejectedAt.role}.</p>}
    </div>
  );
}
