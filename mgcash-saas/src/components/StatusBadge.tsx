import { Badge } from "./ui";
import { STATUS_LABEL } from "../lib/subscription";
import type { SubStatus, TxnStatus } from "../lib/types";

export function SubStatusBadge({ status }: { status: SubStatus }) {
  const tone = { active: "green", trial: "yellow", overdue: "red", expired: "red", deactivated: "slate" } as const;
  return <Badge tone={tone[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function TxnStatusBadge({ status }: { status: TxnStatus }) {
  const map = {
    awaiting_number: ["Hinihintay number", "yellow"],
    pending: ["Pending kay Boss", "blue"],
    approved: ["Approved", "green"],
    rejected: ["Rejected", "red"],
    cancelled: ["Cancelled", "slate"],
  } as const;
  const [label, tone] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}
