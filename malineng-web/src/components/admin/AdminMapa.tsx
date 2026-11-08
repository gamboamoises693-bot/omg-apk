"use client";

import { useState } from "react";
import Link from "next/link";
import { collection, deleteDoc, doc, query, updateDoc, where } from "firebase/firestore";
import { CheckCircle2, MapPin, Plus, Trash2, XCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { logActivity } from "@/lib/activity";
import { friendlyError, timeAgo, tsToMillis } from "@/lib/format";
import { PLACE_REJECT_REASONS, categoryColor, type Place } from "@/lib/places";
import { Button, EmptyState, FilterTabs, LinkButton, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";

type Tab = "pending" | "approved";
const placesCol = collection(db, "places");
const pendingQ = query(placesCol, where("status", "==", "pending"));
const approvedQ = query(placesCol, where("status", "==", "approved"));

/** OpenStreetMap link to double-check the exact spot before approving. */
function osmLink(p: Place): string {
  return `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=18/${p.lat}/${p.lng}`;
}

function PendingCard({ p }: { p: Place }) {
  const toast = useToast();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<string>(PLACE_REJECT_REASONS[0]);
  const [busy, setBusy] = useState(false);

  const decide = async (status: "approved" | "rejected") => {
    setBusy(true);
    try {
      await updateDoc(doc(db, "places", p.id), status === "approved" ? { status, rejectReason: "" } : { status, rejectReason: reason });
      logActivity("Mapa", status === "approved" ? `Inaprubahan ang pin: ${p.name} (${p.ownerName})` : `Tinanggihan ang pin: ${p.name} (${reason})`, p.id);
      toast(status === "approved" ? "Nasa mapa na." : "Tinanggihan. Makikita ng nag-pin ang dahilan.");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-2xl bg-white p-3 shadow-card">
      <div className="flex gap-3">
        {p.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.photo} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: categoryColor(p.category) }}>
            <MapPin className="h-6 w-6" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold">{p.name}</p>
          <p className="text-xs text-gray-600">{p.category} · {p.purok || "walang purok"}</p>
          <p className="text-xs text-gray-500">Ni {p.ownerName} · {timeAgo(p.createdAt)}</p>
        </div>
      </div>
      {(p.hours || p.contact || p.description) && (
        <p className="text-xs text-gray-600">{[p.hours, p.contact, p.description].filter(Boolean).join(" · ")}</p>
      )}
      <a href={osmLink(p)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand">
        <MapPin className="h-3.5 w-3.5" /> Tingnan kung tama ang lokasyon
      </a>
      {rejecting ? (
        <div className="space-y-2 rounded-xl bg-red-50 p-2.5">
          <Select label="Dahilan" options={PLACE_REJECT_REASONS} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setRejecting(false)}>Bumalik</Button>
            <Button variant="danger" loading={busy} onClick={() => decide("rejected")}>Tanggihan</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="!text-red-700" onClick={() => setRejecting(true)}><XCircle className="h-4 w-4" /> Tanggihan</Button>
          <Button loading={busy} onClick={() => decide("approved")}><CheckCircle2 className="h-4 w-4" /> Aprubahan</Button>
        </div>
      )}
    </div>
  );
}

export function AdminMapa() {
  const toast = useToast();
  const pending = useCollection<Place>(pendingQ);
  const approved = useCollection<Place>(approvedQ);
  const [tab, setTab] = useState<Tab>("pending");

  const remove = async (p: Place) => {
    if (!confirm(`Alisin ang "${p.name}" sa mapa?`)) return;
    try {
      await deleteDoc(doc(db, "places", p.id));
      logActivity("Mapa", `Inalis ang pin: ${p.name}`, p.id);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  if (pending.loading || approved.loading) return <Spinner />;

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <LinkButton href="/mapa" variant="soft"><MapPin className="h-4 w-4" /> Buksan ang mapa</LinkButton>
        <LinkButton href="/mapa/pin" variant="gold"><Plus className="h-4 w-4" /> Mag-pin</LinkButton>
      </div>
      <p className="mb-3 text-xs text-gray-500">Para sa Evacuation Center: Mag-pin → Kategorya “Evacuation Center”. Admin lang ang makakapaglagay nito.</p>
      <FilterTabs
        label="Mga pin"
        value={tab}
        onChange={setTab}
        options={[
          { value: "pending", label: "Naghihintay", count: pending.data.length },
          { value: "approved", label: "Nasa mapa", count: approved.data.length, tone: "neutral" },
        ]}
      />
      {tab === "pending" ? (
        pending.data.length === 0 ? (
          <EmptyState title="Walang naghihintay na pin" />
        ) : (
          <div className="space-y-2.5">
            {[...pending.data].sort((a, b) => tsToMillis(a.createdAt) - tsToMillis(b.createdAt)).map((p) => <PendingCard key={p.id} p={p} />)}
          </div>
        )
      ) : approved.data.length === 0 ? (
        <EmptyState title="Wala pang pin sa mapa" />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-card">
          {[...approved.data].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)).map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: categoryColor(p.category) }} />
              <Link href={`/mapa/?id=${p.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{p.name}</p>
                <p className="truncate text-xs text-gray-500">{p.category} · {p.purok || "—"}</p>
              </Link>
              <Link href={`/mapa/pin/?id=${p.id}`} className="text-xs font-semibold text-brand">Ayusin</Link>
              <button onClick={() => remove(p)} className="p-1.5 text-red-700" aria-label={`Alisin ang ${p.name}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
