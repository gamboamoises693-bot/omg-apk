"use client";

import { useMemo, useState, type FormEvent } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Plus } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { logActivity } from "@/lib/activity";
import { formatPeso, friendlyError, sortNewest, timeAgo } from "@/lib/format";
import { advanceRequest, returnRequest } from "@/lib/approval";
import { effectiveSteps, useApprovalConfig } from "@/lib/approvalConfig";
import { DECISION_KINDS, rejectDecision, releaseDecision, type Decision } from "@/lib/decisions";
import { ApprovalPanel } from "@/components/ApprovalPanel";
import { ApprovalTracker } from "@/components/ApprovalTracker";
import { Badge, Button, EmptyState, ErrorText, Input, Select, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";

const decisionsCol = collection(db, "decisions");

/** Important decisions (spending, projects, policies). Any admin prepares one; the approvers set by the Developer decide. */
export function AdminDecisions() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const { data, loading } = useCollection<Decision>(decisionsCol);
  const approvals = useApprovalConfig();
  const steps = effectiveSteps(approvals.des);
  const [adding, setAdding] = useState(false);
  const list = useMemo(() => sortNewest(data), [data]);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-brand-deep p-3 text-sm text-white">
        Para sa <b className="text-gold">mahahalagang desisyon</b>: gastusin, proyekto at patakaran. Pagkatapos ma-release, makikita ng mga residente ang pamagat at detalye sa <b>Mga Desisyon</b> (<b>walang halaga</b>).
      </p>
      {adding ? (
        <DecisionForm onDone={() => setAdding(false)} />
      ) : (
        <Button full onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Bagong desisyon
        </Button>
      )}
      {list.length === 0 ? (
        <EmptyState title="Wala pang desisyon">Pindutin ang &quot;Bagong desisyon&quot; para magsimula.</EmptyState>
      ) : (
        list.map((d) => (
          <article key={d.id} className="space-y-3 rounded-2xl bg-white p-3.5 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-extrabold">{d.title}</p>
                <p className="text-xs text-gray-500">
                  {d.kind}
                  {d.amount ? ` · ${formatPeso(d.amount)}` : ""} · ni {d.authorName} · {timeAgo(d.createdAt)}
                </p>
              </div>
              <Badge color={d.status === "approved" ? "green" : d.status === "rejected" ? "red" : "gold"}>{d.status === "approved" ? "Aprubado" : d.status === "rejected" ? "Tinanggihan" : "Naghihintay"}</Badge>
            </div>
            <p className="whitespace-pre-line text-sm text-gray-800">{d.detail}</p>
            <ApprovalTracker r={d} steps={steps} firstLabel="Inihanda" />
            {d.status === "pending" && user && profile && (
              <ApprovalPanel
                r={d}
                steps={steps}
                onAdvance={async (a, n) => {
                  try {
                    await advanceRequest("decisions", d.id, d, steps, a, n);
                    toast("Naipasa na sa susunod na approver.");
                  } catch (err) {
                    toast(friendlyError(err), "error");
                  }
                }}
                onReturn={async (a, n) => {
                  try {
                    await returnRequest("decisions", d.id, d, steps, a, n);
                    toast("Naibalik sa naunang approver.");
                  } catch (err) {
                    toast(friendlyError(err), "error");
                  }
                }}
                onReject={async (a, n) => {
                  try {
                    await rejectDecision(d, a, n);
                    logActivity("Desisyon", `Tinanggihan ang desisyon: ${d.title}`, d.id);
                    toast("Tinanggihan ang desisyon.");
                  } catch (err) {
                    toast(friendlyError(err), "error");
                  }
                }}
                onRelease={async (a, n) => {
                  try {
                    await releaseDecision(d, a, n);
                    logActivity("Desisyon", `Inaprubahan ang desisyon: ${d.title}`, d.id);
                    toast("Aprubado na. Makikita na ito ng mga residente.");
                  } catch (err) {
                    toast(friendlyError(err), "error");
                  }
                }}
              />
            )}
          </article>
        ))
      )}
    </div>
  );
}

function DecisionForm({ onDone }: { onDone: () => void }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<string>(DECISION_KINDS[0]);
  const [amount, setAmount] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    if (title.trim().length < 3) return setError("Maglagay ng pamagat.");
    if (detail.trim().length < 3) return setError("Isulat ang detalye at dahilan.");
    setBusy(true);
    setError("");
    try {
      await addDoc(decisionsCol, {
        title: title.trim().slice(0, 120),
        kind,
        amount: Math.max(0, Math.round(Number(amount) || 0)),
        detail: detail.trim().slice(0, 1000),
        status: "pending",
        authorId: user.uid,
        authorName: profile.fullName,
        createdAt: serverTimestamp(),
      });
      logActivity("Desisyon", `Iminungkahi: ${title.trim()}`);
      toast("Naipasa na sa approval.");
      onDone();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-3.5 shadow-card">
      <h2 className="font-extrabold">Bagong desisyon</h2>
      <Input label="Pamagat" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="hal. Pagbili ng generator" />
      <Select label="Uri" options={DECISION_KINDS} value={kind} onChange={(e) => setKind(e.target.value)} />
      <Input label="Halaga (₱, optional)" type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} hint="Hindi ito ipinapakita sa mga residente." />
      <Textarea label="Detalye at dahilan" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={1000} />
      <ErrorText>{error}</ErrorText>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" type="button" onClick={onDone}>Bumalik</Button>
        <Button type="submit" loading={busy}>Ipasa sa approval</Button>
      </div>
    </form>
  );
}
