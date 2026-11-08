"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Timestamp, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Minus, Plus, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { logActivity } from "@/lib/activity";
import { friendlyError } from "@/lib/format";
import {
  BORROW_PURPOSES,
  availableQty,
  feeLabel,
  toLocalInput,
  type BorrowBooking,
  type BorrowItem,
} from "@/lib/hiraman";
import { Button, Card, ErrorText, Input, PageHeader, Select, Spinner } from "@/components/ui";
import { RequireVerified } from "@/components/RequireVerified";
import { useToast } from "@/components/Toast";

const itemsCol = collection(db, "borrowItems");
const bookingsCol = collection(db, "borrowBookings");

interface Line {
  itemId: string;
  qty: number;
}

/** Default: tomorrow 8:00 AM → tomorrow 5:00 PM. */
function defaultRange(): [string, string] {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  const end = new Date(d);
  end.setHours(17, 0, 0, 0);
  return [toLocalInput(d.getTime()), toLocalInput(end.getTime())];
}

function BorrowForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, profile } = useAuth();
  const toast = useToast();
  const items = useCollection<BorrowItem>(itemsCol);
  const bookings = useCollection<BorrowBooking>(bookingsCol);

  const [lines, setLines] = useState<Line[]>([]);
  const [[startStr, endStr], setRange] = useState<[string, string]>(defaultRange);
  const [purpose, setPurpose] = useState<string>(BORROW_PURPOSES[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const visible = useMemo(() => items.data.filter((i) => !i.hidden).sort((a, b) => a.name.localeCompare(b.name)), [items.data]);
  const byId = useMemo(() => new Map(visible.map((i) => [i.id, i])), [visible]);

  // Preselect the item tapped on the list page (once items load).
  const preselect = params.get("item") ?? "";
  const preselected = useRef(false);
  useEffect(() => {
    if (preselected.current || !preselect || !byId.has(preselect)) return;
    preselected.current = true;
    setLines((ls) => (ls.length ? ls : [{ itemId: preselect, qty: 1 }]));
  }, [preselect, byId]);

  const start = new Date(startStr).getTime();
  const end = new Date(endStr).getTime();
  const validRange = Number.isFinite(start) && Number.isFinite(end) && end > start;
  const freeFor = (item: BorrowItem) => (validRange ? availableQty(item, bookings.data, start, end) : item.total);

  const addable = visible.filter((i) => !lines.some((l) => l.itemId === i.id));

  const setQty = (id: string, qty: number) => {
    const item = byId.get(id);
    if (!item) return;
    const cap = Math.min(item.maxPerBorrow || item.total, item.total);
    setLines((ls) => ls.map((l) => (l.itemId === id ? { ...l, qty: Math.max(1, Math.min(qty, cap)) } : l)));
  };

  const submit = async () => {
    if (!user || !profile) return;
    setError("");
    if (!validRange) return setError("Dapat mas huli ang pagbalik kaysa sa pagkuha.");
    if (start < Date.now() - 3_600_000) return setError("Nakalipas na ang petsang napili.");
    if (end - start > 14 * 86_400_000) return setError("Hanggang 14 na araw lang ang isang hiram.");
    if (lines.length === 0) return setError("Pumili ng kahit isang gamit.");
    for (const l of lines) {
      const item = byId.get(l.itemId);
      if (!item) return setError("May gamit na wala na sa listahan.");
      const free = freeFor(item);
      if (l.qty > free) return setError(`${item.name}: ${free} na lang ang available sa petsang iyan.`);
    }

    setBusy(true);
    try {
      const reqLines = lines.map((l) => ({ itemId: l.itemId, name: byId.get(l.itemId)!.name, qty: l.qty }));
      const ref = await addDoc(collection(db, "borrowRequests"), {
        userId: user.uid,
        userName: profile.fullName,
        purok: profile.purok ?? "",
        contact: profile.contact ?? "",
        items: reqLines,
        itemIds: reqLines.map((l) => l.itemId),
        start: Timestamp.fromMillis(start),
        end: Timestamp.fromMillis(end),
        purpose,
        note: note.trim().slice(0, 300),
        status: "pending",
        createdAt: serverTimestamp(),
      });
      logActivity("Hiraman", `Humiling humiram: ${reqLines.map((l) => `${l.name} × ${l.qty}`).join(", ")}`, ref.id);
      toast("Naipadala ang request. Hintayin ang approval ng Barangay.");
      router.push("/hiraman");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  if (items.loading || bookings.loading) return <Spinner />;

  return (
    <div>
      <Card className="mb-3 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">1. Kailan</p>
        <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
          <Input label="Kukunin" type="datetime-local" value={startStr} onChange={(e) => setRange([e.target.value, endStr])} />
          <Input label="Ibabalik" type="datetime-local" value={endStr} min={startStr} onChange={(e) => setRange([startStr, e.target.value])} />
        </div>
      </Card>

      <Card className="mb-3 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">2. Anong gamit</p>
        {lines.map((l) => {
          const item = byId.get(l.itemId);
          if (!item) return null;
          const free = freeFor(item);
          const over = l.qty > free;
          return (
            <div key={l.itemId} className={`flex items-center gap-2 rounded-xl border p-2.5 ${over ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{item.name}</p>
                <p className={`text-xs font-semibold ${free > 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {free > 0 ? `${free} available sa petsang ito` : "Wala nang available sa petsang ito"}
                </p>
                <p className="text-[0.7rem] text-gray-500">{feeLabel(item.fee)}{item.maxPerBorrow < item.total ? ` · max ${item.maxPerBorrow}` : ""}</p>
              </div>
              {item.total > 1 && (
                <>
                  <button onClick={() => setQty(l.itemId, l.qty - 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100" aria-label={`Bawasan ang ${item.name}`}>
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={l.qty}
                    onChange={(e) => setQty(l.itemId, Math.floor(Number(e.target.value) || 1))}
                    className="w-12 rounded-lg border border-gray-200 py-1 text-center font-bold"
                    aria-label={`Dami ng ${item.name}`}
                  />
                  <button onClick={() => setQty(l.itemId, l.qty + 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white" aria-label={`Dagdagan ang ${item.name}`}>
                    <Plus className="h-4 w-4" />
                  </button>
                </>
              )}
              <button onClick={() => setLines((ls) => ls.filter((x) => x.itemId !== l.itemId))} className="p-1 text-gray-400" aria-label={`Alisin ang ${item.name}`}>
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
        {addable.length > 0 && lines.length < 10 && (
          <label className="block">
            <span className="mb-1 block text-[0.85rem] font-semibold text-gray-700">{lines.length ? "Magdagdag pa" : "Piliin ang gamit"}</span>
            <select
              value=""
              onChange={(e) => e.target.value && setLines((ls) => [...ls, { itemId: e.target.value, qty: 1 }])}
              className="w-full rounded-xl border border-dashed border-brand bg-white px-3 py-2.5 text-brand"
            >
              <option value="">+ Pumili...</option>
              {addable.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({freeFor(i)} available)
                </option>
              ))}
            </select>
          </label>
        )}
        {lines.map((l) => byId.get(l.itemId)?.note).filter(Boolean).length > 0 && (
          <ul className="space-y-0.5 rounded-xl bg-brand-light p-3 text-xs text-brand-deep">
            {lines.map((l) => {
              const item = byId.get(l.itemId);
              return item?.note ? <li key={l.itemId}><b>{item.name}:</b> {item.note}</li> : null;
            })}
          </ul>
        )}
      </Card>

      <Card className="mb-3 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">3. Para saan</p>
        <Select label="Okasyon" options={BORROW_PURPOSES} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        <Input label="Tala (optional)" placeholder="hal. Sa Purok 3, tapat ng kapilya" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      </Card>

      <p className="mb-3 rounded-xl bg-brand-light p-3 text-[0.82rem] text-brand-deep">
        Ikaw ang mananagot kapag nasira o nawala ang gamit. Kunin at ibalik sa Barangay Hall sa takdang oras.
      </p>
      <ErrorText>{error}</ErrorText>
      <Button full className="mt-2" loading={busy} disabled={lines.length === 0} onClick={submit}>
        Ipadala ang request
      </Button>
    </div>
  );
}

export default function HiramPage() {
  return (
    <div>
      <PageHeader title="Humiram" subtitle="Aaprubahan ng Kapitan o Secretary" />
      <RequireVerified feature="makahiram ng gamit">
        <Suspense fallback={<Spinner />}>
          <BorrowForm />
        </Suspense>
      </RequireVerified>
    </div>
  );
}
