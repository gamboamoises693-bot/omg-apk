"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, query, updateDoc, where } from "firebase/firestore";
import { Package, ShieldCheck } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { logActivity } from "@/lib/activity";
import { friendlyError, sortNewest } from "@/lib/format";
import { waitingLabel } from "@/lib/approval";
import { ApprovalTracker } from "@/components/ApprovalTracker";
import {
  BORROW_STATUS_LABEL,
  availableQty,
  feeLabel,
  formatWhen,
  isLate,
  linesText,
  nextReturn,
  reportSummary,
  upcomingReservations,
  type BorrowBooking,
  type BorrowItem,
  type BorrowRequest,
} from "@/lib/hiraman";
import { EmptyState, FilterTabs, LinkButton, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";

type Filter = "lahat" | "available" | "nakahiram";
const itemsCol = collection(db, "borrowItems");
const bookingsCol = collection(db, "borrowBookings");

/** Re-render every minute so "available now" and LATE flip on time. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** The signed-in resident's active or recent requests. */
function MyRequests() {
  const { user } = useAuth();
  const toast = useToast();
  const now = useNow();
  const q = useMemo(() => (user ? query(collection(db, "borrowRequests"), where("userId", "==", user.uid)) : null), [user]);
  const { data } = useCollection<BorrowRequest>(q);

  const active = sortNewest(data).filter(
    (r) =>
      ["pending", "approved", "borrowed"].includes(r.status) ||
      (r.status === "rejected" && now - (r.createdAt?.toMillis() ?? 0) < 7 * 86_400_000) ||
      // A returned request stays visible while a charge for damage is unpaid.
      (r.status === "returned" && (r.damageFee ?? 0) > 0 && r.feeStatus === "unpaid"),
  );
  const past = sortNewest(data).filter((r) => ["returned", "rejected", "cancelled"].includes(r.status) && !active.includes(r));
  const [showPast, setShowPast] = useState(false);
  if (active.length === 0 && past.length === 0) return null;

  const cancel = async (r: BorrowRequest) => {
    if (!confirm("Kanselahin ang request na ito?")) return;
    try {
      await updateDoc(doc(db, "borrowRequests", r.id), { status: "cancelled" });
      logActivity("Hiraman", `Kinansela ang request: ${linesText(r.items)}`, r.id);
      toast("Nakansela ang request.");
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <div className="mb-4 space-y-2">
      {active.map((r) => {
        const late = isLate(r, now);
        return (
          <div key={r.id} className="rounded-2xl bg-gradient-to-br from-brand to-brand-deep p-4 text-white shadow-float">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-white/75">Request mo</p>
                <p className="font-extrabold">{linesText(r.items)}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.7rem] font-extrabold ${late ? "bg-red-500 text-white" : r.status === "rejected" ? "bg-white/20" : "bg-gold text-brand-deep"}`}>
                {late ? "LATE" : r.status === "approved" ? "Aprubado" : r.status === "borrowed" ? "Nakahiram" : r.status === "pending" ? "Naghihintay" : r.status === "returned" ? "May singil" : "Hindi aprubado"}
              </span>
            </div>
            <p className="mt-1 text-xs text-white/85">
              {formatWhen(r.start)} → {formatWhen(r.end)}
            </p>
            <p className={`mt-0.5 text-xs font-semibold ${late ? "text-red-200" : "text-gold"}`}>
              {late
                ? "Lampas na sa oras. Ibalik agad sa Barangay Hall."
                : r.status === "rejected"
                  ? `Dahilan: ${r.rejectReason ?? "—"}`
                  : r.status === "returned"
                    ? `Naibalik na, pero ${reportSummary(r.returnReport)}. Singil: ₱${(r.damageFee ?? 0).toLocaleString("en-PH")}. Magbayad sa Barangay Hall.`
                    : BORROW_STATUS_LABEL[r.status]}
            </p>
            {(r.status === "pending" || (r.status === "rejected" && (r.trail?.length ?? 0) > 0)) && (
              <div className="mt-3 space-y-1.5 border-t border-white/15 pt-3">
                {r.status === "pending" && <p className="text-xs font-extrabold text-gold">{waitingLabel(r)} ang magpapasya</p>}
                <ApprovalTracker r={r} dark />
              </div>
            )}
            {r.status === "pending" && (
              <button onClick={() => cancel(r)} className="mt-2 text-xs font-semibold text-white/85 underline">
                Kanselahin
              </button>
            )}
          </div>
        );
      })}
      {past.length > 0 && (
        <div className="rounded-2xl bg-white shadow-card">
          <button type="button" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast} className="flex w-full items-center justify-between px-4 py-3 text-sm font-bold text-brand-dark">
            Kasaysayan ko ({past.length})
            <span aria-hidden>{showPast ? "▲" : "▼"}</span>
          </button>
          {showPast && (
            <ul className="divide-y divide-line border-t border-line">
              {past.slice(0, 30).map((r) => (
                <li key={r.id} className="px-4 py-2.5 text-sm">
                  <p className="font-bold">{linesText(r.items)}</p>
                  <p className="text-xs text-gray-600">
                    {formatWhen(r.start)} → {formatWhen(r.end)} · {r.status === "returned" ? "Naibalik" : r.status === "rejected" ? `Hindi naaprubahan${r.rejectReason ? `: ${r.rejectReason}` : ""}` : "Kinansela"}
                  </p>
                  {r.status === "returned" && reportSummary(r.returnReport) && (
                    <p className="text-xs font-semibold text-red-700">
                      {reportSummary(r.returnReport)}
                      {(r.damageFee ?? 0) > 0 ? ` · singil ₱${(r.damageFee ?? 0).toLocaleString("en-PH")} (${r.feeStatus === "paid" ? "bayad na" : r.feeStatus === "waived" ? "pinatawad" : "hindi pa bayad"})` : ""}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function HiramanPage() {
  const { canBorrowAdmin } = useAuth();
  const now = useNow();
  const items = useCollection<BorrowItem>(itemsCol);
  const bookings = useCollection<BorrowBooking>(bookingsCol);
  const [filter, setFilter] = useState<Filter>("lahat");

  const rows = useMemo(
    () =>
      items.data
        .filter((i) => !i.hidden)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => ({ item, free: availableQty(item, bookings.data, now, now + 1, now), back: nextReturn(item, bookings.data, now), reserved: upcomingReservations(item, bookings.data, now) })),
    [items.data, bookings.data, now],
  );
  const list = rows.filter((r) => (filter === "available" ? r.free > 0 : filter === "nakahiram" ? r.free < r.item.total : true));

  return (
    <div>
      <PageHeader title="Hiraman ng Gamit" subtitle="Tent, upuan, mesa at iba pa ng Barangay" />
      {canBorrowAdmin && (
        <LinkButton href="/admin/#hiraman" variant="gold" full className="mb-3">
          <ShieldCheck className="h-5 w-5" /> Pamahalaan ang Hiraman
        </LinkButton>
      )}
      <MyRequests />

      <FilterTabs
        label="Filter ng gamit"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "lahat", label: "Lahat" },
          { value: "available", label: "Available" },
          { value: "nakahiram", label: "Nakahiram" },
        ]}
      />

      {items.loading || bookings.loading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState icon={<Package />} title={rows.length === 0 ? "Wala pang nakalistang gamit" : "Walang tugma"} />
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {list.map(({ item, free, back, reserved }) => (
            <div key={item.id} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-card">
              {item.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.photo} alt={item.name} className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-brand-light text-brand">
                  <Package className="h-9 w-9" aria-hidden />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-1 p-2.5">
                <p className="text-sm font-bold leading-tight">{item.name}</p>
                {free > 0 ? (
                  <p className="text-xs font-bold text-emerald-700">{item.total > 1 ? `${free} sa ${item.total} available ngayon` : "Available ngayon"}</p>
                ) : (
                  <>
                    <p className="text-xs font-bold text-amber-700">Nakahiram lahat</p>
                    {back && <p className="text-[0.7rem] text-gray-500">Babalik: {formatWhen(back)}</p>}
                  </>
                )}
                {reserved.length > 0 && (
                  <p className="text-[0.7rem] font-semibold text-brand-dark">
                    May reserba: {reserved[0].qty} sa {formatWhen(reserved[0].start)}
                    {reserved.length > 1 ? ` (+${reserved.length - 1} pa)` : ""}
                  </p>
                )}
                <p className="text-[0.7rem] text-gray-500">{feeLabel(item.fee)}</p>
                <Link
                  href={`/hiraman/hiram/?item=${item.id}`}
                  className={`mt-auto rounded-xl py-2 text-center text-[0.82rem] font-bold ${free > 0 ? "bg-brand text-white" : "border border-gray-200 text-gray-700"}`}
                >
                  {free > 0 ? "Hiramin" : "Magpa-reserve"}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-center text-xs text-gray-500">Verified na residente lang ang pwedeng humiram. Kunin at ibalik sa Barangay Hall.</p>
    </div>
  );
}
