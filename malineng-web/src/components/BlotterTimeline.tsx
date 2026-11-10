import { BLOTTER_FLOW, BLOTTER_STATUS, formatHearing, type Blotter } from "@/lib/blotter";

function when(ts: { toDate?: () => Date } | undefined): string {
  const d = ts?.toDate?.();
  return d ? d.toLocaleString("fil-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
}

/** Natanggap → Ipinatawag → Naayos (or Isinara), with notes from the Barangay. */
export function BlotterTimeline({ b }: { b: Blotter }) {
  const reached = new Set(b.history.map((h) => h.status));
  const steps = b.status === "isinara" ? [...BLOTTER_FLOW.filter((s) => reached.has(s)), "isinara" as const] : BLOTTER_FLOW;

  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const ev = [...b.history].reverse().find((h) => h.status === s);
        const done = !!ev;
        return (
          <li key={s} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${done ? "bg-brand" : "border-2 border-gray-300 bg-white"}`} aria-hidden />
              {i < steps.length - 1 && <span className={`w-0.5 flex-1 ${done ? "bg-brand" : "bg-gray-200"}`} aria-hidden />}
            </div>
            <div className="pb-3">
              <p className={`text-sm font-bold ${done ? "" : "text-gray-400"}`}>{BLOTTER_STATUS[s].label}</p>
              {ev && <p className="text-xs text-gray-500">{when(ev.at)}{ev.by ? ` · ${ev.by}` : ""}</p>}
              {ev?.note && <p className="text-[0.82rem] text-gray-700">{ev.note}</p>}
              {s === "ipinatawag" && b.hearingAt && <p className="text-[0.82rem] font-semibold text-brand">Pagdinig: {formatHearing(b.hearingAt)}, Barangay Hall</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
