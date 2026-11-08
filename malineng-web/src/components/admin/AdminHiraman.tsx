"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { CheckCircle2, EyeOff, Package, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { useVerifiedSet } from "@/lib/useVerifiedSet";
import { logActivity } from "@/lib/activity";
import { compressToDataUrl } from "@/lib/upload";
import { friendlyError, telHref, timeAgo, tsToMillis } from "@/lib/format";
import {
  BORROW_REJECT_REASONS,
  approveRequest,
  availableQty,
  feeLabel,
  formatWhen,
  isLate,
  linesText,
  markBorrowed,
  markReturned,
  ms,
  rejectRequest,
  type BorrowBooking,
  type BorrowItem,
  type BorrowRequest,
} from "@/lib/hiraman";
import { Badge, Button, EmptyState, FilterTabs, Input, Modal, Select, Spinner } from "@/components/ui";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useToast } from "@/components/Toast";

type Tab = "request" | "hiram" | "naibalik" | "gamit";

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

/* ---------------- Request card ---------------- */

function RequestCard({ r, items, bookings, now, verified }: { r: BorrowRequest; items: BorrowItem[]; bookings: BorrowBooking[]; now: number; verified: boolean }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<string>(BORROW_REJECT_REASONS[0]);
  const actor = user && profile ? { uid: user.uid, name: profile.fullName } : null;
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
      setRejecting(false);
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

      {shortages.length > 0 && <p className="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{shortages.join(" · ")}</p>}

      {r.status === "pending" &&
        (rejecting ? (
          <div className="space-y-2 rounded-xl bg-red-50 p-2.5">
            <Select label="Dahilan" options={BORROW_REJECT_REASONS} value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setRejecting(false)}>Bumalik</Button>
              <Button variant="danger" loading={busy} onClick={() => run(() => rejectRequest(r, reason, actor!), "Tinanggihan ang request.", `Tinanggihan ang hiram: ${what} (${reason})`)}>Tanggihan</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="outline" className="!text-red-700" onClick={() => setRejecting(true)}>Tanggihan</Button>
            <Button loading={busy} disabled={shortages.length > 0} onClick={() => run(() => approveRequest(r, actor!), "Naaprubahan. Naka-reserve na ang gamit.", `Inaprubahan ang hiram: ${what}`)}>
              Aprubahan
            </Button>
          </div>
        ))}

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
          ) : (
            <Button
              loading={busy}
              onClick={() => {
                const note = prompt("Naibalik na? Ilagay kung may sira o kulang (o iwanang blangko):", "") ;
                if (note === null) return;
                run(() => markReturned(r, note, actor!), "Naibalik na. Available ulit ang gamit.", `Naibalik ang hiram: ${what}${note ? ` (${note})` : ""}`);
              }}
            >
              <CheckCircle2 className="h-4 w-4" /> Naibalik na
            </Button>
          )}
        </div>
      )}
      {r.status === "approved" && (
        <button
          onClick={() => confirm(`Kanselahin ang naaprubahang hiram ni ${r.userName}?`) && run(() => rejectRequest(r, "Kinansela ng Barangay", actor!), "Nakansela.", `Kinansela ang hiram: ${what}`)}
          className="w-full pt-1 text-center text-xs font-semibold text-red-700"
        >
          Kanselahin (hindi kinuha)
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
                  </div>
                  <button onClick={() => toggleHidden(i)} className="rounded-lg p-2 text-gray-500 active:bg-gray-100" aria-label={i.hidden ? `Ipakita ang ${i.name}` : `Itago ang ${i.name}`}>
                    <EyeOff className={`h-4 w-4 ${i.hidden ? "text-red-600" : ""}`} />
                  </button>
                  <button onClick={() => setEditing(i)} className="rounded-lg p-2 text-brand active:bg-gray-100" aria-label={`Ayusin ang ${i.name}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
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
  const now = useNow();
  const verified = useVerifiedSet();
  const items = useCollection<BorrowItem>(itemsCol);
  const bookings = useCollection<BorrowBooking>(bookingsCol);
  const open = useCollection<BorrowRequest>(openQ);
  const done = useCollection<BorrowRequest>(doneQ);
  const [tab, setTab] = useState<Tab>("request");

  const sortedItems = useMemo(() => [...items.data].sort((a, b) => a.name.localeCompare(b.name)), [items.data]);
  const pending = open.data.filter((r) => r.status === "pending").sort((a, b) => tsToMillis(a.createdAt) - tsToMillis(b.createdAt));
  // Late first, then by return date.
  const out = open.data
    .filter((r) => r.status === "approved" || r.status === "borrowed")
    .sort((a, b) => Number(isLate(b, now)) - Number(isLate(a, now)) || ms(a.end) - ms(b.end));
  const lateCount = out.filter((r) => isLate(r, now)).length;
  const history = [...done.data].sort((a, b) => tsToMillis(b.returnedAt ?? b.createdAt) - tsToMillis(a.returnedAt ?? a.createdAt)).slice(0, 50);

  if (items.loading || open.loading) return <Spinner />;
  if (open.error) return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{open.error}</p>;

  const list = tab === "request" ? pending : tab === "hiram" ? out : history;

  return (
    <div>
      <FilterTabs
        label="Hiraman"
        value={tab}
        onChange={setTab}
        options={[
          { value: "request", label: "Request", count: pending.length },
          { value: "hiram", label: "Hiram", count: lateCount || out.length, tone: lateCount ? "alert" : "neutral" },
          { value: "naibalik", label: "Naibalik" },
          { value: "gamit", label: "Gamit" },
        ]}
      />
      {tab === "gamit" ? (
        <ItemsTab items={sortedItems} bookings={bookings.data} now={now} />
      ) : list.length === 0 ? (
        <EmptyState
          title={tab === "request" ? "Walang naghihintay na request" : tab === "hiram" ? "Walang nakahiram ngayon" : "Wala pang naibalik"}
        />
      ) : (
        <div className="space-y-2.5">
          {list.map((r) => (
            <RequestCard key={r.id} r={r} items={items.data} bookings={bookings.data} now={now} verified={verified.has(r.userId)} />
          ))}
        </div>
      )}
    </div>
  );
}
