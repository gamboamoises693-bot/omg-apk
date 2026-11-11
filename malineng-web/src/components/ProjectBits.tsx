import { PROJECT_STATUS_LABEL } from "@/lib/constants";
import type { InfraProjectStatus } from "@/lib/types";

const STATUS_STYLE: Record<InfraProjectStatus, string> = {
  planned: "bg-gray-100 text-gray-700",
  ongoing: "bg-blue-50 text-blue-700",
  completed: "bg-brand-light text-brand",
  delayed: "bg-red-50 text-red-700",
};

export function ProjectStatusPill({ status }: { status: InfraProjectStatus }) {
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[status]}`}>{PROJECT_STATUS_LABEL[status]}</span>;
}

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-brand to-gold" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Order: ongoing/delayed first, then planned, then completed (newest first inside each). */
export function projectSortKey(status: InfraProjectStatus): number {
  return { ongoing: 0, delayed: 1, planned: 2, completed: 3 }[status];
}

/**
 * Order for every project list: ongoing first, then delayed, planned and finished ones.
 * Finished projects go by the date they were completed (newest first), so an older project added later
 * still sits in its real place; the others go by the last update.
 */
export function compareProjects(
  a: { status: InfraProjectStatus; completedDate?: string; updatedAt?: { toMillis(): number } | null },
  b: { status: InfraProjectStatus; completedDate?: string; updatedAt?: { toMillis(): number } | null },
): number {
  const byStatus = projectSortKey(a.status) - projectSortKey(b.status);
  if (byStatus) return byStatus;
  if (a.status === "completed" && b.status === "completed") {
    const byDone = (b.completedDate ?? "").localeCompare(a.completedDate ?? "");
    if (byDone) return byDone;
  }
  return (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0);
}
