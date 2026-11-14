"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { CheckCircle2, EyeOff, Package, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { useVerifiedSet } from "@/lib/useVerifiedSet";
import { logActivity } from "@/lib/activity";
import { compressToDataUrl } from "@/lib/upload";
import { friendlyError, telHref, timeAgo, tsToMillis } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import {
  acceptReturn,
  approveRequest,
  availableQty,
  feeLabel,
  formatWhen,
  historyRows,
  isLate,
  linesText,
  markBorrowed,
  ms,
  rejectRequest,
  reportSummary,
  sendReturnBack,
  setFeeStatus,
  settleDamaged,
  startReturn,
  type BorrowBooking,
  type BorrowItem,
  type BorrowRequest,
  type ReturnLine,
} from "@/lib/hiraman";
import { Badge, Button, EmptyState, FilterTabs, Input, Modal, Spinner } from "@/components/ui";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ApprovalPanel } from "@/components/ApprovalPanel";
import { ApprovalTracker } from "@/components/ApprovalTracker";
import { advanceRequest, isMyTurn, returnRequest, stageOf, trailLine, type Actor } from "@/lib/approval";
import { effectiveSteps, stepLabel, useApprovalConfig } from "@/lib/approvalConfig";
import { useToast } from "@/components/Toast";

type Tab = "request" | "hiram" | "naibalik" | "gamit";
type HistoryFilter = "lahat" | "problema" | "singil";

const itemsCol = collection(db, "borrowItems");
const bookingsCol = collection(db, "borrowBookings");
// Active + recent history; old returned/rejected requests stay in Firestore but aren't loaded.
const openQ = query(collection(db, "borrowRequests"), where("status", "in", ["pending", "approved", "borrowed"]));
const doneQ = query(collection(db, "borrowRequests"), where("status", "in", ["returned", "rejected", "cancelled"]));

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/* ---------------- Return dialog ---------------- */

/** Count what came back: fine, damaged or lost, per item. A charge can be recorded for damage or loss. */
function ReturnDialog({ r, onClose, onSave }: { r: BorrowRequest; onClose: () => void; onSave: (report: ReturnLine[], note: string, fee: number) => Promise<void> }) {
  const [rows, setRows] = useState(() => r.items.map((l) => ({ itemId: l.itemId, name: l.name, qty: l.qty, damaged: "0", lost: "0" })));
  const [note, setNote] = useState("");
  const [fee, setFee] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const n = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
  const bad = rows.some((x) => n(x.damaged) + n(x.lost) > x.qty);
  const anyProblem = rows.some((x) => n(x.damaged) + n(x.lost) > 0);

  const save = async () => {
    if (bad) return setError("Hindi pwedeng lampas sa hiniram ang sira at nawala.");
    setBusy(true);
    setError("");
    try {
      const report: ReturnLine[] = rows.map((x) => ({ itemId: x.itemId, name: x.name, damaged: n(x.damaged), lost: n(x.lost), good: x.qty - n(x.damaged) - n(x.lost) }));
      await onSave(report, note, anyProblem ? Number(fee) || 0 : 0);
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Bilangin ang ibinalik ni <b>{r.userName}</b>. Iwanang 0 kung walang sira o nawala.</p>
      {rows.map((x, i) => (
        <div key={x.itemId} className="space-y-1.5 rounded-xl border border-gray-200 p-3">
          <p className="font-bold">{x.name} <span className="font-normal text-gray-500">· hiniram: {x.qty}</span></p>
          <div className="grid grid-cols-2 gap-2">
            <Input label="May sira" type="number" inputMode="numeric" min={0} max={x.qty} value={x.damaged} onChange={(e) => setRows((p) => p.map((y, k) => (k === i ? { ...y, damaged: e.target.value } : y)))} />
            <Input label="Nawala" type="number" inputMode="numeric" min={0} max={x.qty} value={x.lost} onChange={(e) => setRows((p) => p.map((y, k) => (k === i ? { ...y, lost: e.target.value } : y)))} />
          </div>
          <p className="text-xs font-semibold text-emerald-700">Maayos: {Math.max(0, x.qty - n(x.damaged) - n(x.lost))}</p>
        </div>
      ))}
      {anyProblem && (
        <>
          <Input label="Singil sa nakasira o nawala (₱)" type="number" inputMode="decimal" min={0} value={fee} onChange={(e) => setFee(e.target.value)} hint="Iwanang blangko kung walang singil. Makikita ito ng humiram." />
          <p className="rounded-xl bg-gold-light p-2.5 text-xs text-yellow-900">Ang may sira ay <b>hindi na mabibilang na available</b> hanggang hindi naaayos (Gamit tab). Ang nawala ay aalisin sa bilang.</p>
        </>
      )}
      <Input label="Tala (optional)" placeholder="hal. Nabali ang paa ng 2 upuan" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onClose}>Bumalik</Button>
        <Button loading={busy} onClick={save}>I-save ang pagbabalik</Button>
      </div>
    </div>
  );
}

/* ---------------- Return approval ---------------- */

/**
 * The return of a hiram after the borrower handed the items back: the approvers set for "Hiraman: Pagbabalik"
 * accept it in order. The first approver checks the condition; the last one accepts and closes the hiram.
 */
function ReturnApproval({ r, steps, actor, what }: { r: BorrowRequest; steps: string[]; actor: Actor | null; what: string }) {
  const { isSuperAdmin, isAdmin, profile } = useAuth();
  const toast = useToast();
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const rs = Math.max(0, r.returnStage ?? 0);
  const synthetic = { status: "pending", stage: rs, trail: r.returnTrail };
  const mine = isMyTurn(synthetic, steps, { isSuperAdmin, isAdmin, position: profile?.position });
  const first = stageOf(synthetic, steps) === 0;
  const last = stageOf(synthetic, steps) >= steps.length - 1;
  const summary = reportSummary(r.returnReport);

  const act = async (fn: () => Promise<void>, ok: string, log: string) => {
    setBusy(true);
    try {
      await fn();
      logActivity("Hiraman", log, r.id);
      toast(ok);
      setNote("");
      setChecking(false);
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl bg-brand-light/60 p-2.5">
      <p className="text-xs font-extrabold text-brand-deep">PAGBABALIK NG GAMIT · {stepLabel(steps[stageOf(synthetic, steps)])} ang tatanggap</p>
      <ApprovalTracker r={synthetic} steps={steps} firstLabel="Ibinalik" trail={r.returnTrail} />
      {!first && (
        <p className="text-xs text-gray-700">
          {summary ? <>Ulat: <b>{summary}</b>{(r.damageFee ?? 0) > 0 ? ` · singil ₱${r.damageFee}` : ""}.</> : <>Ulat: maayos ang lahat.</>}
          {r.returnNote ? ` ${r.returnNote}` : ""}
        </p>
      )}
      {mine && (
        <div className="space-y-2">
          {isSuperAdmin && <p className="text-[0.7rem] font-bold text-purple-700">DEVELOPER OVERRIDE · ikaw ang kumikilos para kay {stepLabel(steps[stageOf(synthetic, steps)])}</p>}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} aria-label="Paalala" placeholder="Paalala (kailangan kung ibabalik)" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            {first ? (
              <Button loading={busy} onClick={() => setChecking(true)}>Suriin ang gamit</Button>
            ) : (
              <Button loading={busy} onClick={() => actor && act(() => acceptReturn(r, steps, actor, note), last ? "Tinanggap at isinara ang hiram." : "Tinanggap. Naipasa sa susunod na approver.", `Tinanggap ang pagbabalik: ${what}`)}>
                {last ? "Tanggapin at isara" : "Tanggapin, ipasa"}
              </Button>
            )}
            <Button
              variant="outline"
              loading={busy}
              onClick={() => (note.trim() ? actor && act(() => sendReturnBack(r, actor, note, true), "Naibalik sa residente.", `Ibinalik sa residente ang pagbabalik: ${what}`) : toast("Maglagay muna ng paalala.", "error"))}
            >
              Ibalik sa residente
            </Button>
            {!first && (
              <Button
                variant="outline"
                className="col-span-2"
                loading={busy}
                onClick={() => (note.trim() ? actor && act(() => sendReturnBack(r, actor, note, false), "Naibalik sa naunang approver.", `Ibinalik ang pagbabalik: ${what}`) : toast("Maglagay muna ng paalala.", "error"))}
              >
                Ibalik kay {stepLabel(steps[stageOf(synthetic, steps) - 1])}
              </Button>
            )}
          </div>
        </div>
      )}
      <Modal open={checking} onClose={() => setChecking(false)} title="Kondisyon ng gamit">
        {checking && (
          <ReturnDialog
            r={r}
            onClose={() => setChecking(false)}
            onSave={async (report, rnote, fee) => {
              if (!actor) return;
              await acceptReturn(r, steps, actor, note, { report, note: rnote, fee });
              const problem = reportSummary(report);
              logActivity("Hiraman", `Sinuri ang pagbabalik: ${what}${problem ? `. ${problem}` : ""}${fee ? ` (singil ₱${fee})` : ""}`, r.id);
              toast(last ? (problem ? "Naibalik na. Na-update ang bilang ng gamit." : "Naibalik na. Available ulit ang gamit.") : "Naipasa na sa susunod na approver.");
              setChecking(false);
              setNote("");
            }}
          />
        )}
      </Modal>
    </div>
  );
}

/* ---------------- Request card ---------------- */

function RequestCard({ r, items, bookings, now, verified }: { r: BorrowRequest; items: BorrowItem[]; bookings: BorrowBooking[]; now: number; verified: boolean }) {
  const { user, profile, isSuperAdmin } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const approvals = useApprovalConfig();
  const reqSteps = effectiveSteps(approvals.hiram);
  const retSteps = effectiveSteps(approvals.balik);
  const actor = user && profile ? { uid: user.uid, name: profile.fullName, role: isSuperAdmin ? "Developer" : profile.position ?? "Admin" } : null;
  const late = isLate(r, now);

  // Re-check dates against current bookings before approving (another request may have been approved meanwhile).
  const shortages = useMemo(() => {
    if (r.status !== "pending") return [];
    return r.items
      .map((l) => {
        const item = items.find((i) => i.id === l.itemId);
        if (!item) return `${l.name}: wala na sa listahan`;
        const free = availableQty(item, bookings, ms(r.start), ms(r.end), now, r.id);
        return l.qty > free ? `${l.name}: ${free} na lang ang available` : "";
      })
      .filter(Boolean);
  }, [r, items, bookings, now]);

  const run = async (fn: () => Promise<void>, ok: string, log: string) => {
    if (!actor) return;
    setBusy(true);
    try {
      await fn();
      logActivity("Hiraman", log, r.id);
      toast(ok);
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const what = `${linesText(r.items)} ni ${r.userName}`;

  return (
    <div className={`space-y-1.5 rounded-2xl bg-white p-3 shadow-card ${late ? "ring-2 ring-red-300" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-bold">
          {r.userName} <VerifiedBadge show={verified} />
        </p>
        {late ? (
          <Badge color="red">LATE {Math.max(1, Math.floor((now - ms(r.end)) / 86_400_000))} araw</Badge>
        ) : r.status === "pending" ? (
          <span className="shrink-0 text-xs text-gray-500">{timeAgo(r.createdAt)}</span>
        ) : r.status === "approved" ? (
          <Badge color="gold">Hindi pa nakukuha</Badge>
        ) : r.status === "borrowed" ? (
          <Badge color="blue">Nakahiram</Badge>
        ) : (
          <Badge color={r.status === "returned" ? "green" : "gray"}>{r.status === "returned" ? "Naibalik" : r.status === "rejected" ? "Tinanggihan" : "Kinansela"}</Badge>
        )}
      </div>
      <p className="text-sm">{linesText(r.items)} · {r.purpose}</p>
      <p className={`text-xs ${late ? "font-semibold text-red-700" : "text-gray-600"}`}>
        {formatWhen(r.start)} → {formatWhen(r.end)}
      </p>
      <p className="text-xs text-gray-500">
        {r.purok || "Walang purok"}
        {r.contact ? ` · ${r.contact}` : ""}
        {r.note ? ` · ${r.note}` : ""}
      </p>
      {r.status === "rejected" && r.rejectReason && <p className="text-xs text-gray-500">Dahilan: {r.rejectReason}</p>}
      {r.status === "returned" && <p className="text-xs text-gray-500">Naibalik {timeAgo(r.returnedAt)}{r.returnNote ? ` · ${r.returnNote}` : ""}</p>}
      {r.status === "returned" && reportSummary(r.returnReport) && (
        <div className="space-y-1.5 rounded-lg bg-red-50 p-2 text-xs text-red-800">
          <p className="font-semibold">May problema: {reportSummary(r.returnReport)}</p>
          {(r.damageFee ?? 0) > 0 && (
            <div className="flex items-center justify-between gap-2">
              <span>Singil: <b>₱{(r.damageFee ?? 0).toLocaleString("en-PH")}</b> · {r.feeStatus === "paid" ? "Bayad na" : r.feeStatus === "waived" ? "Pinatawad" : "Hindi pa bayad"}</span>
              {r.feeStatus === "unpaid" && (
                <span className="flex gap-1.5">
                  <button className="rounded-lg bg-white px-2 py-1 font-bold text-emerald-800" onClick={() => run(() => setFeeStatus(r, "paid"), "Naitala: bayad na.", `Nabayaran ang singil ni ${r.userName}`)}>Bayad na</button>
                  <button className="rounded-lg bg-white px-2 py-1 font-bold text-gray-700" onClick={() => run(() => setFeeStatus(r, "waived"), "Pinatawad ang singil.", `Pinatawad ang singil ni ${r.userName}`)}>Patawarin</button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {shortages.length > 0 && <p className="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{shortages.join(" · ")}</p>}

      {(r.status === "pending" || r.status === "approved" || r.status === "rejected") && (r.status === "pending" || (r.trail?.length ?? 0) > 0) && <ApprovalTracker r={r} steps={reqSteps} />}
      {r.status === "pending" && (
        <ApprovalPanel
          r={r}
          steps={reqSteps}
          releaseDisabled={shortages.length > 0}
          onAdvance={(a, n) => run(() => advanceRequest("borrowRequests", r.id, r, reqSteps, a, n), "Naipasa na sa susunod na approver.", `Naipasa ang hiram: ${what}`)}
          onReturn={(a, n) => run(() => returnRequest("borrowRequests", r.id, r, reqSteps, a, n), "Naibalik sa naunang approver.", `Ibinalik ang hiram: ${what}`)}
          onReject={(a, n) => run(() => rejectRequest(r, n, a), "Tinanggihan ang request.", `Tinanggihan ang hiram: ${what} (${n})`)}
          onRelease={(a, n) => run(() => approveRequest(r, a, n), "Nailabas. Naka-reserve na ang gamit.", `Inilabas ang hiram: ${what}`)}
        />
      )}

      {(r.status === "approved" || r.status === "borrowed") && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          {r.contact ? (
            <a href={telHref(r.contact)} className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-light py-2.5 text-sm font-bold text-brand">
              <Phone className="h-4 w-4" /> Tawagan
            </a>
          ) : (
            <span />
          )}
          {r.status === "approved" ? (
            <Button loading={busy} onClick={() => run(() => markBorrowed(r), "Naitala: nakuha na ang gamit.", `Nakuha na ang hiram: ${what}`)}>Nakuha na</Button>
          ) : (r.returnStage ?? -1) >= 0 ? (
            <span />
          ) : (
            <Button
              loading={busy}
              onClick={() => actor && confirm(`Itala na naibalik na ni ${r.userName} ang gamit? Susunod ang pagtanggap ng mga approver.`) && run(() => startReturn(r, actor, true), "Naitala ang pagbabalik. Hinihintay ang pagtanggap.", `Naibalik na raw ang hiram: ${what}`)}
            >
              <CheckCircle2 className="h-4 w-4" /> Naibalik na
            </Button>
          )}
        </div>
      )}
      {r.status === "borrowed" && (r.returnStage ?? -1) === -1 && (r.returnTrail?.length ?? 0) > 0 && (
        <p className="rounded-lg bg-yellow-50 p-2 text-xs text-yellow-900">{trailLine(r.returnTrail![r.returnTrail!.length - 1])}</p>
      )}
      {r.status === "borrowed" && (r.returnStage ?? -1) >= 0 && <ReturnApproval r={r} steps={retSteps} actor={actor} what={what} />}
      {r.status === "approved" && (
        <button
          onClick={() => confirm(`Kanselahin ang naaprubahang hiram ni ${r.userName}?`) && run(() => rejectRequest(r, "Kinansela ng Barangay", actor!), "Nakansela.", `Kinansela ang hiram: ${what}`)}
          className="w-full pt-1 text-center text-xs font-semibold text-red-700"
        >
          Kanselahin (hindi kinuha)
        </button>
      )}
      {isSuperAdmin && ["returned", "rejected", "cancelled"].includes(r.status) && (
        <button
          type="button"
          onClick={() => {
            const unpaid = (r.damageFee ?? 0) > 0 && r.feeStatus === "unpaid";
            if (!confirm(`Burahin ang tala ni ${r.userName} (${linesText(r.items)}) sa kasaysayan?${unpaid ? "\n\nBABALA: may singil pa na hindi bayad." : ""}\nHindi na ito maibabalik.`)) return;
            run(() => deleteDoc(doc(db, "borrowRequests", r.id)), "Nabura ang tala.", `Binura ang tala sa kasaysayan ng Hiraman: ${what}`);
          }}
          className="flex w-full items-center justify-center gap-1.5 pt-1 text-center text-xs font-semibold text-red-700"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden /> Burahin sa kasaysayan
        </button>
      )}
    </div>
  );
}

/* ---------------- Item form ---------------- */

function ItemForm({ existing, onDone }: { existing?: BorrowItem; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(existing?.name ?? "");
  const [total, setTotal] = useState(String(existing?.total ?? 1));
  const [maxPer, setMaxPer] = useState(String(existing?.maxPerBorrow ?? 1));
  const [fee, setFee] = useState(String(existing?.fee ?? 0));
  const [note, setNote] = useState(existing?.note ?? "");
  const [photo, setPhoto] = useState(existing?.photo ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (file?: File) => {
    if (!file) return;
    try {
      setPhoto(await compressToDataUrl(file, 360, 0.72, 140_000, true));
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const save = async () => {
    setError("");
    const t = Math.floor(Number(total));
    const m = Math.floor(Number(maxPer));
    const f = Number(fee);
    if (!name.trim()) return setError("Ilagay ang pangalan ng gamit.");
    if (!(t >= 0)) return setError("Mali ang bilang.");
    if (!(m >= 1)) return setError("Ang max kada hiram ay dapat 1 pataas.");
    if (!(f >= 0)) return setError("Mali ang bayad.");
    setBusy(true);
    try {
      const data = { name: name.trim(), total: t, maxPerBorrow: Math.min(m, Math.max(t, 1)), fee: f, note: note.trim().slice(0, 200), photo, hidden: existing?.hidden ?? false };
      if (existing) {
        await updateDoc(doc(db, "borrowItems", existing.id), data);
        logActivity("Hiraman", `Inayos ang gamit: ${data.name}`, existing.id);
      } else {
        const ref = doc(collection(db, "borrowItems"));
        await setDoc(ref, { ...data, createdAt: serverTimestamp() });
        logActivity("Hiraman", `Nagdagdag ng gamit: ${data.name} (${t})`, ref.id);
      }
      toast("Na-save ang gamit.");
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block cursor-pointer">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Litrato ng gamit" className="mx-auto aspect-square w-40 rounded-2xl object-cover" />
        ) : (
          <span className="mx-auto flex aspect-square w-40 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-brand/40 bg-brand-light text-sm font-semibold text-brand">
            <Package className="h-7 w-7" /> Litrato ng gamit
          </span>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {photo && <button onClick={() => setPhoto("")} className="mx-auto block text-xs font-semibold text-red-700">Alisin ang litrato</button>}
      <Input label="Pangalan" placeholder="hal. Tent (10x10)" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      <div className="grid grid-cols-2 gap-2">
        <Input label="Ilan lahat" type="number" inputMode="numeric" min={0} value={total} onChange={(e) => setTotal(e.target.value)} />
        <Input label="Max kada hiram" type="number" inputMode="numeric" min={1} value={maxPer} onChange={(e) => setMaxPer(e.target.value)} />
      </div>
      <Input label="Bayad kada hiram (₱)" type="number" inputMode="decimal" min={0} value={fee} onChange={(e) => setFee(e.target.value)} hint="0 = libre" />
      <Input label="Paalala sa hihiram (optional)" placeholder="hal. Linisin bago ibalik" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button full loading={busy} onClick={save}>I-save</Button>
    </div>
  );
}

/* ---------------- Items tab ---------------- */

function ItemsTab({ items, bookings, now }: { items: BorrowItem[]; bookings: BorrowBooking[]; now: number }) {
  const toast = useToast();
  const [editing, setEditing] = useState<BorrowItem | null>(null);
  const [adding, setAdding] = useState(false);

  const run = async (fn: () => Promise<void>, ok: string, log: string, id: string) => {
    try {
      await fn();
      logActivity("Hiraman", log, id);
      toast(ok);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const toggleHidden = async (i: BorrowItem) => {
    try {
      await updateDoc(doc(db, "borrowItems", i.id), { hidden: !i.hidden });
      logActivity("Hiraman", `${i.hidden ? "Ipinakita ulit" : "Itinago"} ang gamit: ${i.name}`, i.id);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const remove = async (i: BorrowItem) => {
    if (bookings.some((b) => b.itemIds.includes(i.id))) return toast("May naka-reserve o nakahiram pa nito. Itago muna.", "error");
    if (!confirm(`Burahin ang ${i.name}?`)) return;
    try {
      await deleteDoc(doc(db, "borrowItems", i.id));
      logActivity("Hiraman", `Binura ang gamit: ${i.name}`, i.id);
      setEditing(null);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <div>
      <Button variant="gold" full className="mb-3" onClick={() => setAdding(true)}>
        <Plus className="h-4 w-4" /> Magdagdag ng gamit
      </Button>
      {items.length === 0 ? (
        <EmptyState icon={<Package />} title="Wala pang gamit. Idagdag ang tent, upuan, mesa at iba pa." />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-card">
          {items.map((i) => {
            const free = availableQty(i, bookings, now, now + 1, now);
            const sched = bookings.filter((b) => b.itemIds.includes(i.id)).sort((a, b) => ms(a.start) - ms(b.start));
            return (
              <li key={i.id} className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  {i.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.photo} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand"><Package className="h-5 w-5" /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-bold ${i.hidden ? "text-gray-400 line-through" : ""}`}>{i.name}</p>
                    <p className="truncate text-xs text-gray-500">{free}/{i.total} available ngayon · {feeLabel(i.fee)}</p>
                    {(i.damaged ?? 0) > 0 && <p className="text-xs font-bold text-red-700">May sira: {i.damaged}</p>}
                  </div>
                  <button onClick={() => toggleHidden(i)} className="rounded-lg p-2 text-gray-500 active:bg-gray-100" aria-label={i.hidden ? `Ipakita ang ${i.name}` : `Itago ang ${i.name}`}>
                    <EyeOff className={`h-4 w-4 ${i.hidden ? "text-red-600" : ""}`} />
                  </button>
                  <button onClick={() => setEditing(i)} className="rounded-lg p-2 text-brand active:bg-gray-100" aria-label={`Ayusin ang ${i.name}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
                {(i.damaged ?? 0) > 0 && (
                  <div className="mt-1.5 flex gap-2 pl-14">
                    <button
                      className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 active:bg-emerald-100"
                      onClick={() => run(() => settleDamaged(i, 1, "repair"), `Naayos ang 1 ${i.name}.`, `Naayos ang 1 ${i.name}`, i.id)}
                    >
                      1 ang naayos na
                    </button>
                    <button
                      className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 active:bg-red-100"
                      onClick={() => confirm(`Itapon ang 1 sirang ${i.name}? Mababawasan ang kabuuang bilang.`) && run(() => settleDamaged(i, 1, "discard"), `Tinanggal ang 1 ${i.name}.`, `Itinapon ang 1 sirang ${i.name}`, i.id)}
                    >
                      Itapon ang 1
                    </button>
                  </div>
                )}
                {sched.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 pl-14 text-xs text-gray-600">
                    {sched.slice(0, 4).map((b) => (
                      <li key={b.id}>
                        {formatWhen(b.start)} → {formatWhen(b.end)} · <b>{b.items.find((x) => x.itemId === i.id)?.qty ?? 0}</b>
                        {b.status === "borrowed" ? " (nakahiram)" : " (reserved)"}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Bagong gamit">
        {adding && <ItemForm onDone={() => setAdding(false)} />}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.name ?? "Gamit"}>
        {editing && (
          <>
            <ItemForm key={editing.id} existing={editing} onDone={() => setEditing(null)} />
            <button onClick={() => remove(editing)} className="mt-3 flex w-full items-center justify-center gap-1.5 py-2 text-sm font-semibold text-red-700">
              <Trash2 className="h-4 w-4" /> Burahin ang gamit
            </button>
          </>
        )}
      </Modal>
    </div>
  );
}

/* ---------------- Main ---------------- */

export function AdminHiraman() {
  const { isSuperAdmin, canBorrowAdmin } = useAuth();
  const toast = useToast();
  const now = useNow();
  const verified = useVerifiedSet();
  const items = useCollection<BorrowItem>(itemsCol);
  const bookings = useCollection<BorrowBooking>(bookingsCol);
  const open = useCollection<BorrowRequest>(openQ);
  const done = useCollection<BorrowRequest>(doneQ);
  const [tab, setTab] = useState<Tab>("request");
  const [histFilter, setHistFilter] = useState<HistoryFilter>("lahat");
  const [histSearch, setHistSearch] = useState("");

  const sortedItems = useMemo(() => [...items.data].sort((a, b) => a.name.localeCompare(b.name)), [items.data]);
  const pending = open.data.filter((r) => r.status === "pending").sort((a, b) => tsToMillis(a.createdAt) - tsToMillis(b.createdAt));
  // Late first, then by return date.
  const out = open.data
    .filter((r) => r.status === "approved" || r.status === "borrowed")
    .sort((a, b) => Number(isLate(b, now)) - Number(isLate(a, now)) || ms(a.end) - ms(b.end));
  const lateCount = out.filter((r) => isLate(r, now)).length;
  const allHistory = useMemo(() => [...done.data].sort((a, b) => tsToMillis(b.returnedAt ?? b.createdAt) - tsToMillis(a.returnedAt ?? a.createdAt)), [done.data]);
  const unpaidCount = allHistory.filter((r) => (r.damageFee ?? 0) > 0 && r.feeStatus === "unpaid").length;
  const history = useMemo(() => {
    const t = histSearch.trim().toLowerCase();
    return allHistory
      .filter((r) => (histFilter === "problema" ? !!reportSummary(r.returnReport) : histFilter === "singil" ? (r.damageFee ?? 0) > 0 && r.feeStatus === "unpaid" : true))
      .filter((r) => !t || `${r.userName} ${r.purok} ${linesText(r.items)} ${r.purpose}`.toLowerCase().includes(t));
  }, [allHistory, histFilter, histSearch]);

  if (items.loading || open.loading) return <Spinner />;
  if (open.error) return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{open.error}</p>;

  const list = tab === "request" ? pending : tab === "hiram" ? out : history;

  return (
    <div>
      <FilterTabs
        label="Hiraman"
        value={tab}
        onChange={setTab}
        // Admins who only take part in the approval steps (not Kapitan/Secretary) see the requests and the borrowed items, to accept returns.
        options={
          canBorrowAdmin
            ? [
                { value: "request", label: "Request", count: pending.length },
                { value: "hiram", label: "Hiram", count: lateCount || out.length, tone: lateCount ? "alert" : "neutral" },
                { value: "naibalik", label: "Kasaysayan", count: unpaidCount, tone: "alert" },
                { value: "gamit", label: "Gamit" },
              ]
            : [
                { value: "request", label: "Request", count: pending.length },
                { value: "hiram", label: "Hiram", count: lateCount || out.length, tone: lateCount ? "alert" : "neutral" },
              ]
        }
      />
      {tab === "naibalik" && (
        <div className="mb-3 space-y-2">
          <input
            value={histSearch}
            onChange={(e) => setHistSearch(e.target.value)}
            placeholder="Hanapin: pangalan, gamit, layunin..."
            aria-label="Hanapin sa kasaysayan"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5"
          />
          <FilterTabs<HistoryFilter>
            label="Salain ang kasaysayan"
            value={histFilter}
            onChange={setHistFilter}
            options={[
              { value: "lahat", label: "Lahat" },
              { value: "problema", label: "May sira" },
              { value: "singil", label: "Hindi bayad", count: unpaidCount, tone: "alert" },
            ]}
          />
          <Button variant="outline" full disabled={history.length === 0} onClick={() => downloadCsv(`hiraman-kasaysayan-${new Date().toISOString().slice(0, 10)}.csv`, historyRows(history))}>
            I-download ang {history.length} sa Excel (CSV)
          </Button>
          {isSuperAdmin && history.length > 0 && (
            <Button
              variant="outline"
              full
              className="!text-red-700"
              onClick={async () => {
                const unpaid = history.filter((r) => (r.damageFee ?? 0) > 0 && r.feeStatus === "unpaid").length;
                const typed = prompt(`Burahin ang ${history.length} tala na nakikita ngayon sa kasaysayan?${unpaid ? `\n${unpaid} dito ang may singil na hindi pa bayad.` : ""}\nHindi na ito maibabalik. I-download muna ang CSV kung kailangan.\n\nI-type ang BURAHIN para magpatuloy:`);
                if (typed?.trim().toUpperCase() !== "BURAHIN") return;
                try {
                  for (let i = 0; i < history.length; i += 400) {
                    const batch = writeBatch(db);
                    history.slice(i, i + 400).forEach((r) => batch.delete(doc(db, "borrowRequests", r.id)));
                    await batch.commit();
                  }
                  logActivity("Hiraman", `Binura ang ${history.length} tala sa kasaysayan ng Hiraman`);
                  toast(`Nabura ang ${history.length} tala.`);
                } catch (err) {
                  toast(friendlyError(err), "error");
                }
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden /> Burahin ang {history.length} na nakikita
            </Button>
          )}
        </div>
      )}
      {tab === "gamit" ? (
        <ItemsTab items={sortedItems} bookings={bookings.data} now={now} />
      ) : list.length === 0 ? (
        <EmptyState
          title={tab === "request" ? "Walang naghihintay na request" : tab === "hiram" ? "Walang nakahiram ngayon" : "Walang nahanap sa kasaysayan"}
        />
      ) : (
        <div className="space-y-2.5">
          {list.slice(0, 200).map((r) => (
            <RequestCard key={r.id} r={r} items={items.data} bookings={bookings.data} now={now} verified={verified.has(r.userId)} />
          ))}
        </div>
      )}
    </div>
  );
}
