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
import { MAX_BATCH_FAMILIES, rejectAyudaBatch, releaseAyudaBatch, type AyudaBatch } from "@/lib/ayudaBatch";
import type { Ayuda } from "@/lib/types";
import { ApprovalPanel } from "@/components/ApprovalPanel";
import { ApprovalTracker } from "@/components/ApprovalTracker";
import { Badge, Button, EmptyState, ErrorText, Input, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";

const batchesCol = collection(db, "ayudaBatches");
const ayudaCol = collection(db, "ayuda");

/** Release of ayuda in batches: prepared by an admin, approved by the steps the Developer set. Tracking only: no money moves. */
export function AdminAyudaBatches() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const { data, loading } = useCollection<AyudaBatch>(batchesCol);
  const approvals = useApprovalConfig();
  const steps = effectiveSteps(approvals.ayuda);
  const [adding, setAdding] = useState(false);
  const list = useMemo(() => sortNewest(data), [data]);

  if (loading) return <Spinner />;

  const run = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn();
      toast(ok);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-brand-deep p-3 text-sm text-white">
        Pagkatapos ma-<b className="text-gold">release</b> ng huling approver, ang mga pamilyang <b>Qualified</b> sa napiling programa ay magiging <b>Naka-schedule</b> sa Ayuda Checker. Pang-talaan lang ang halaga; walang perang gumagalaw dito.
      </p>
      {adding ? (
        <BatchForm onDone={() => setAdding(false)} />
      ) : (
        <Button full onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Bagong batch ng ayuda
        </Button>
      )}
      {list.length === 0 ? (
        <EmptyState title="Wala pang batch">Pindutin ang &quot;Bagong batch ng ayuda&quot; para magsimula.</EmptyState>
      ) : (
        list.map((b) => (
          <article key={b.id} className="space-y-3 rounded-2xl bg-white p-3.5 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-extrabold">{b.title}</p>
                <p className="text-xs text-gray-500">
                  {b.program} · {b.families} pamilya · {formatPeso(b.perFamily)} bawat isa · Petsa: {b.date} · ni {b.authorName} · {timeAgo(b.createdAt)}
                </p>
              </div>
              <Badge color={b.status === "approved" ? "green" : b.status === "rejected" ? "red" : "gold"}>{b.status === "approved" ? "Nailabas" : b.status === "rejected" ? "Tinanggihan" : "Naghihintay"}</Badge>
            </div>
            <p className="rounded-xl bg-brand-deep px-3 py-2 text-sm text-white">
              <b className="text-gold">Kabuuan:</b> {formatPeso(b.families * b.perFamily)}
            </p>
            <ApprovalTracker r={b} steps={steps} firstLabel="Inihanda" />
            {b.status === "approved" && <p className="rounded-xl bg-green-50 p-2.5 text-xs font-semibold text-green-800">Nailabas na. Ang {b.families} pamilya ay Naka-schedule na sa {b.date}.</p>}
            {b.status === "pending" && user && profile && (
              <ApprovalPanel
                r={b}
                steps={steps}
                releaseNote="Paalala (optional)"
                onAdvance={(a, n) => run(() => advanceRequest("ayudaBatches", b.id, b, steps, a, n), "Naipasa na sa susunod na approver.")}
                onReturn={(a, n) => run(() => returnRequest("ayudaBatches", b.id, b, steps, a, n), "Naibalik sa naunang approver.")}
                onReject={(a, n) => run(async () => { await rejectAyudaBatch(b, a, n); logActivity("Ayuda", `Tinanggihan ang batch: ${b.title}`, b.id); }, "Tinanggihan ang batch.")}
                onRelease={(a, n) => run(async () => { await releaseAyudaBatch(b, a, n); logActivity("Ayuda", `Nailabas ang batch: ${b.title} (${b.families} pamilya)`, b.id); }, "Nailabas na. Naka-schedule na ang mga pamilya.")}
              />
            )}
          </article>
        ))
      )}
    </div>
  );
}

function BatchForm({ onDone }: { onDone: () => void }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const { data: ayuda, loading } = useCollection<Ayuda>(ayudaCol);
  const programs = useMemo(() => [...new Set(ayuda.map((a) => a.program).filter(Boolean))].sort(), [ayuda]);
  const [title, setTitle] = useState("");
  const [program, setProgram] = useState("");
  const [per, setPer] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const chosen = program || programs[0] || "";
  const qualified = useMemo(() => ayuda.filter((a) => a.status === "qualified" && a.program === chosen), [ayuda, chosen]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    if (title.trim().length < 3) return setError("Maglagay ng pangalan ng batch.");
    if (qualified.length === 0) return setError("Walang Qualified na pamilya sa programang ito.");
    if (qualified.length > MAX_BATCH_FAMILIES) return setError(`Lampas sa ${MAX_BATCH_FAMILIES} pamilya. Hatiin muna sa mas maliliit na batch (palitan ang programa o hatiin ang listahan).`);
    if (!date.trim()) return setError("Ilagay ang petsa ng pamamahagi.");
    setBusy(true);
    setError("");
    try {
      await addDoc(batchesCol, {
        title: title.trim().slice(0, 120),
        program: chosen,
        controlNumbers: qualified.map((a) => a.id),
        families: qualified.length,
        perFamily: Math.max(0, Math.round(Number(per) || 0)),
        date: date.trim().slice(0, 40),
        status: "pending",
        authorId: user.uid,
        authorName: profile.fullName,
        createdAt: serverTimestamp(),
      });
      logActivity("Ayuda", `Inihanda ang batch: ${title.trim()} (${qualified.length} pamilya)`);
      toast("Naipasa na sa approval.");
      onDone();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-3.5 shadow-card">
      <h2 className="font-extrabold">Bagong batch ng ayuda</h2>
      <Input label="Pangalan ng batch" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="hal. Rice assistance, Batch 3" />
      {programs.length === 0 ? (
        <p className="rounded-xl bg-yellow-50 p-2.5 text-sm text-yellow-900">Wala pang listahan sa Ayuda Checker. Idagdag muna ang mga benepisyaryo sa tab na Ayuda.</p>
      ) : (
        <Select label="Programa" options={programs} value={chosen} onChange={(e) => setProgram(e.target.value)} hint={`${qualified.length} pamilyang Qualified ang isasama.`} />
      )}
      <Input label="Halaga bawat pamilya (₱)" type="number" inputMode="numeric" min={0} value={per} onChange={(e) => setPer(e.target.value)} />
      <Input label="Petsa ng pamamahagi" value={date} onChange={(e) => setDate(e.target.value)} maxLength={40} placeholder="hal. Nob 28" />
      <ErrorText>{error}</ErrorText>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" type="button" onClick={onDone}>Bumalik</Button>
        <Button type="submit" loading={busy} disabled={programs.length === 0}>Ipasa sa approval</Button>
      </div>
    </form>
  );
}
