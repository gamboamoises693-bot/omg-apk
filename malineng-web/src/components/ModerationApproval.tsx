"use client";

import { doc, serverTimestamp, updateDoc, type DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { advanceRequest, newEntry, returnRequest, withEntry, type Actor, type Approvable } from "@/lib/approval";
import { effectiveSteps, useApprovalConfig, type ActionKey } from "@/lib/approvalConfig";
import { ApprovalPanel } from "@/components/ApprovalPanel";
import { ApprovalTracker } from "@/components/ApprovalTracker";
import { useToast } from "@/components/Toast";
import { friendlyError } from "@/lib/format";
import { logActivity, type ActivityType } from "@/lib/activity";

/**
 * Approve / reject something a resident submitted (post, paninda, trabaho, bakante, document ready).
 * Follows the approvers the Developer set for `actionKey` ("post" or "dok"). When approval is off, any admin
 * decides with one tap, as before. `releasedStatus` is what the last approver sets ("approved", or "ready" for documents).
 */
export function ModerationApproval({
  collectionName,
  item,
  actionKey = "post",
  releasedStatus = "approved",
  releaseExtra,
  rejectable = true,
  tab,
  what,
  releaseLabel = "Approve",
}: {
  collectionName: string;
  item: Approvable & { id: string };
  actionKey?: Extract<ActionKey, "post" | "dok">;
  releasedStatus?: string;
  /** Extra fields written together with the release (e.g. the 24-hour clock of a listing). */
  releaseExtra?: () => DocumentData;
  rejectable?: boolean;
  tab: ActivityType;
  what: string;
  releaseLabel?: string;
}) {
  const toast = useToast();
  const approvals = useApprovalConfig();
  const steps = effectiveSteps(approvals[actionKey], actionKey);
  const multi = steps.length > 1 || (item.trail?.length ?? 0) > 0;

  const run = async (fn: () => Promise<void>, ok: string, log: string) => {
    try {
      await fn();
      logActivity(tab, log, item.id);
      toast(ok);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <div className="space-y-2">
      {multi && <ApprovalTracker r={item} steps={steps} firstLabel="Isinumite" />}
      <ApprovalPanel
        r={item}
        steps={steps}
        releaseLabel={releaseLabel}
        canReject={rejectable}
        releaseNote="Paalala (kailangan kung tatanggihan o ibabalik)"
        onAdvance={(a, n) => run(() => advanceRequest(collectionName, item.id, item, steps, a, n), "Naipasa na sa susunod na approver.", `Naipasa: ${what}`)}
        onReturn={(a, n) => run(() => returnRequest(collectionName, item.id, item, steps, a, n), "Naibalik sa naunang approver.", `Ibinalik: ${what}`)}
        onReject={(a: Actor, n) =>
          rejectable
            ? run(
                () => updateDoc(doc(db, collectionName, item.id), { status: "rejected", trail: withEntry(item.trail, newEntry("reject", a, n)), updatedAt: serverTimestamp() }),
                "Na-reject.",
                `Nag-reject ng ${what} (${n})`,
              )
            : Promise.resolve()
        }
        onRelease={(a: Actor, n) =>
          run(
            () => updateDoc(doc(db, collectionName, item.id), { status: releasedStatus, ...(releaseExtra?.() ?? {}), trail: withEntry(item.trail, newEntry("release", a, n)), updatedAt: serverTimestamp() }),
            "Na-approve!",
            `Nag-approve ng ${what}`,
          )
        }
      />
    </div>
  );
}
