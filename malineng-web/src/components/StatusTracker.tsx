import { CheckCircle2, Circle } from "lucide-react";
import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_LABEL } from "@/lib/constants";
import type { Appointment } from "@/lib/types";

/** Visual tracker: Natanggap -> Nasa Kagawad -> Ready */
export function StatusTracker({ status }: { status: Appointment["status"] }) {
  const currentIndex = APPOINTMENT_STATUSES.indexOf(status);
  return (
    <ol className="mt-3 space-y-2">
      {APPOINTMENT_STATUSES.map((s, i) => {
        const done = i <= currentIndex;
        return (
          <li key={s} className={`flex items-center gap-3 ${done ? "font-bold text-brand" : "text-gray-400"}`}>
            {done ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
            {APPOINTMENT_STATUS_LABEL[s]}
          </li>
        );
      })}
    </ol>
  );
}
