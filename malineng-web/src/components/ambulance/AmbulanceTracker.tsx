import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { REQUEST_STATUS_LABEL, endTime, formatTime12, DEFAULT_DURATION } from "@/lib/ambulance";
import { formatDate } from "@/lib/format";
import type { AmbulanceRequest } from "@/lib/types";
import { waitingLabel } from "@/lib/approval";
import { ApprovalTracker } from "@/components/ApprovalTracker";

const FLOW = ["pending", "approved", "enroute", "done"] as const;
const STEP_TEXT: Record<(typeof FLOW)[number], string> = {
  pending: "Natanggap ng Barangay",
  approved: "Naaprubahan at naka-schedule",
  enroute: "Papunta na ang ambulansya",
  done: "Tapos na ang biyahe",
};

export const STATUS_PILL: Record<AmbulanceRequest["status"], string> = {
  pending: "bg-gold-light text-yellow-800",
  approved: "bg-brand-light text-brand",
  enroute: "bg-blue-100 text-blue-700",
  done: "bg-gray-100 text-gray-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

/** Status stepper + key details of one request (resident view). */
export function AmbulanceTracker({ req }: { req: AmbulanceRequest }) {
  const stopped = req.status === "rejected" || req.status === "cancelled";
  const current = FLOW.indexOf(req.status as (typeof FLOW)[number]);
  const hours = req.durationHours ?? DEFAULT_DURATION[req.type];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-bold leading-tight">{req.type === "emergency" ? "🚨 Emergency" : req.reason}</p>
          <p className="text-gray-600">
            {formatDate(req.date)} · {formatTime12(req.time)}
            {req.status !== "pending" && !stopped && ` – ${formatTime12(endTime(req.time, hours))}`}
          </p>
          <p className="text-sm text-gray-500">{req.patientName} · {req.pickup}{req.destination ? ` → ${req.destination}` : ""}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${STATUS_PILL[req.status]}`}>{REQUEST_STATUS_LABEL[req.status]}</span>
      </div>

      {stopped ? (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-red-800">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{req.status === "cancelled" ? "Na-cancel ang request." : "Hindi naaprubahan ang request."}{req.adminNote ? ` ${req.adminNote}` : ""}</span>
        </p>
      ) : (
        <ol className="space-y-2">
          {FLOW.map((s, i) => {
            const done = i <= current;
            return (
              <li key={s} className={`flex items-center gap-3 ${done ? "font-bold text-brand" : "text-gray-400"}`}>
                {done ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
                {STEP_TEXT[s]}
              </li>
            );
          })}
        </ol>
      )}

      {(req.status === "pending" || (stopped && (req.trail?.length ?? 0) > 0)) && (
        <div className="space-y-1.5 rounded-xl bg-surface p-3">
          {req.status === "pending" && <p className="text-sm font-bold text-brand">{waitingLabel(req)} ang magpapasya</p>}
          <ApprovalTracker r={req} />
        </div>
      )}
      {!stopped && req.driver && <p className="rounded-xl bg-brand-light p-3 text-brand"><b>Driver:</b> {req.driver}</p>}
      {!stopped && req.adminNote && <p className="rounded-xl bg-gold-light p-3 text-yellow-900"><b>Paalala ng Barangay:</b> {req.adminNote}</p>}
    </div>
  );
}
