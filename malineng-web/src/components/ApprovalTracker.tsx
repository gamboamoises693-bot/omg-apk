import { Check, X } from "lucide-react";
import { STAGE_NAMES, stageOf, trailLine, type Approvable } from "@/lib/approval";

const DONE_TEXT = ["Inendorso", "Sumang-ayon", "Inilabas"] as const;
const NOW_TEXT = ["Sumusuri", "Sumasang-ayon", "Magre-release"] as const;

/**
 * The 3-step tracker (Secretary -> Admin -> Kapitan) plus the log of who did what.
 * Shown to residents too, so they can see whose turn it is.
 */
export function ApprovalTracker({ r, showLog = true, dark = false }: { r: Approvable; showLog?: boolean; /** On a navy card (resident Hiraman card). */ dark?: boolean }) {
  const s = stageOf(r);
  const released = r.status !== "pending" && r.status !== "rejected" && r.status !== "cancelled";
  // For a rejected request the last "reject" entry tells which step said no.
  const rejectedAt = r.status === "rejected" ? [...(r.trail ?? [])].reverse().find((t) => t.step === "reject") : undefined;
  const rejStage = r.status === "rejected" ? (r.urgent ? 2 : s) : -1;
  const trail = r.trail ?? [];

  return (
    <div className="space-y-2">
      <ol className="grid grid-cols-4 gap-1 text-center" aria-label="Takbo ng approval">
        <li className="flex min-w-0 flex-col items-center gap-0.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-white"><Check className="h-4 w-4" aria-hidden /></span>
          <span className={`text-[0.7rem] font-bold ${dark ? "text-white" : ""}`}>Isinumite</span>
        </li>
        {STAGE_NAMES.map((name, i) => {
          const state = released || (r.status === "pending" && i < s) ? "done" : r.status === "pending" && i === s ? "now" : r.status === "rejected" && i === rejStage ? "bad" : r.status === "rejected" && i < rejStage ? "done" : "wait";
          return (
            <li key={name} className="flex min-w-0 flex-col items-center gap-0.5">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${
                  state === "done" ? "bg-green-600 text-white" : state === "now" ? "bg-gold text-brand-deep ring-4 ring-gold/30" : state === "bad" ? "bg-red-600 text-white" : dark ? "border-2 border-white/40 text-white/60" : "border-2 border-gray-300 text-gray-400"
                }`}
              >
                {state === "done" ? <Check className="h-4 w-4" aria-hidden /> : state === "bad" ? <X className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              <span className={`text-[0.7rem] font-bold ${dark ? "text-white" : ""}`}>{name}</span>
              <span className={`text-[0.62rem] leading-tight ${dark ? "text-white/70" : "text-gray-500"}`}>{state === "done" ? DONE_TEXT[i] : state === "now" ? NOW_TEXT[i] : state === "bad" ? "Tinanggihan" : "Susunod"}</span>
            </li>
          );
        })}
      </ol>
      {showLog && trail.length > 0 && (
        <ul className={`space-y-0.5 rounded-xl p-2.5 text-xs ${dark ? "bg-white/10 text-white/85" : "bg-surface text-gray-600"}`}>
          {trail.map((t, i) => (
            <li key={i}>{trailLine(t)}</li>
          ))}
        </ul>
      )}
      {rejectedAt && !rejectedAt.note && <p className={`text-xs ${dark ? "text-red-200" : "text-red-700"}`}>Tinanggihan ni {rejectedAt.role}.</p>}
    </div>
  );
}
