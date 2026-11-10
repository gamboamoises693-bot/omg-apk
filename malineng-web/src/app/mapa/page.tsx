"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { collection, deleteDoc, doc, query, setDoc, where } from "firebase/firestore";
import { Clock, Crosshair, MapPin, MessageCircle, Navigation, Phone, Plus, Search, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { useSettings } from "@/lib/useSettings";
import { logActivity } from "@/lib/activity";
import { friendlyError, telHref, withCustomOptions } from "@/lib/format";
import { DEFAULT_MAP_CENTER, EVACUATION, PLACE_CATEGORIES, categoryColor, directionsUrl, type Place } from "@/lib/places";
import { LeafletMap, type MapHandle } from "@/components/map/LeafletMap";
import { Badge, Modal, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";

const approvedQ = query(collection(db, "places"), where("status", "==", "approved"));

function PlaceSheet({ p, onClose }: { p: Place; onClose: () => void }) {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const canDelete = !!user && (isAdmin || p.ownerId === user.uid);

  const remove = async () => {
    if (!confirm(`Alisin ang "${p.name}" sa mapa?`)) return;
    try {
      await deleteDoc(doc(db, "places", p.id));
      logActivity("Mapa", `Inalis ang pin: ${p.name}`, p.id);
      toast("Naalis sa mapa.");
      onClose();
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <div className="space-y-3">
      {p.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.photo} alt={p.name} className="aspect-video w-full rounded-2xl object-cover" />
      )}
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ background: categoryColor(p.category) }}>
          {p.category}
        </span>
        {p.purok && <Badge color="gray">{p.purok}</Badge>}
      </div>
      <dl className="space-y-1.5 text-sm text-gray-700">
        {p.hours && (
          <div className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><dd>{p.hours}</dd></div>
        )}
        {p.description && (
          <div className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><dd>{p.description}</dd></div>
        )}
      </dl>
      <div className="grid grid-cols-2 gap-2">
        {p.contact ? (
          <a href={telHref(p.contact)} className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-light py-3 text-sm font-bold text-brand">
            <Phone className="h-4 w-4" /> Tawagan
          </a>
        ) : (
          <span className="flex items-center justify-center gap-1.5 rounded-xl bg-gray-50 py-3 text-sm text-gray-400">
            <MessageCircle className="h-4 w-4" /> Walang contact
          </span>
        )}
        <a href={directionsUrl(p)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl bg-brand py-3 text-sm font-bold text-white">
          <Navigation className="h-4 w-4" /> Direksyon
        </a>
      </div>
      {p.ownerName && p.category !== EVACUATION && <p className="text-xs text-gray-500">Ipinin ni {p.ownerName}</p>}
      {canDelete && (
        <div className="flex items-center justify-between">
          {user && p.ownerId === user.uid && (
            <Link href={`/mapa/pin/?id=${p.id}`} className="text-sm font-semibold text-brand">Ayusin ang pin</Link>
          )}
          <button onClick={remove} className="ml-auto flex items-center gap-1 text-sm font-semibold text-red-700">
            <Trash2 className="h-4 w-4" /> Alisin
          </button>
        </div>
      )}
    </div>
  );
}

/** The signed-in resident's own pins that are waiting or were not approved. */
function MyPendingPins() {
  const { user } = useAuth();
  const q = useMemo(() => (user ? query(collection(db, "places"), where("ownerId", "==", user.uid)) : null), [user]);
  const { data } = useCollection<Place>(q);
  const mine = data.filter((p) => p.status !== "approved");
  if (mine.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Mga pin mo</p>
      {mine.map((p) => (
        <div key={p.id} className="flex items-center gap-2 rounded-2xl bg-white p-3 text-sm shadow-card">
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{p.name}</p>
            <p className="text-xs text-gray-500">{p.status === "pending" ? "Naghihintay ng approval" : `Hindi naaprubahan: ${p.rejectReason ?? ""}`}</p>
          </div>
          <Link href={`/mapa/pin/?id=${p.id}`} className="shrink-0 text-xs font-bold text-brand">Ayusin</Link>
        </div>
      ))}
    </div>
  );
}

function MapaContent() {
  const params = useSearchParams();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const { settings, loading: settingsLoading } = useSettings();
  const { data: places, loading } = useCollection<Place>(approvedQ);
  const mapRef = useRef<MapHandle>(null);
  const [category, setCategory] = useState("Lahat");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(params.get("id"));

  const center = settings.mapCenter ?? DEFAULT_MAP_CENTER;
  const visible = useMemo(() => {
    const t = search.trim().toLowerCase();
    return places.filter((p) => (category === "Lahat" || p.category === category) && (!t || `${p.name} ${p.description} ${p.purok}`.toLowerCase().includes(t)));
  }, [places, category, search]);
  const selected = places.find((p) => p.id === selectedId) ?? null;

  // Deep link (/mapa?id=...): fly to the pin once it has loaded.
  const flewTo = useRef(false);
  useEffect(() => {
    if (flewTo.current || !selected) return;
    flewTo.current = true;
    mapRef.current?.flyTo(selected.lat, selected.lng, 17);
  }, [selected]);

  const locate = () => {
    if (!navigator.geolocation) return toast("Hindi suportado ng phone ang GPS.", "error");
    navigator.geolocation.getCurrentPosition(
      (pos) => mapRef.current?.flyTo(pos.coords.latitude, pos.coords.longitude, 17),
      () => toast("Hindi makuha ang lokasyon. Buksan ang GPS at payagan ang website.", "error"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const saveCenter = async () => {
    const v = mapRef.current?.getView();
    if (!v) return;
    if (!confirm("Gawing default na gitna ng mapa ang nakikita ngayon?")) return;
    try {
      await setDoc(doc(db, "settings", "main"), { mapCenter: { lat: v.lat, lng: v.lng, zoom: Math.round(v.zoom) } }, { merge: true });
      logActivity("Settings", "Itinakda ang gitna ng Mapa ng Malineng");
      toast("Na-save ang gitna ng mapa.");
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  // Wait for settings so the map opens on the saved center.
  if (settingsLoading) return <Spinner />;

  return (
    <div>
      <div className="relative -mx-4 h-[calc(100dvh-13rem)] min-h-[22rem] overflow-hidden">
        <LeafletMap ref={mapRef} center={center} places={visible} selectedId={selectedId} onSelect={(p) => setSelectedId(p.id)} className="absolute inset-0" />

        {/* Search + category chips over the map */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] space-y-2">
          <label className="pointer-events-auto flex items-center gap-2 rounded-full bg-white px-4 shadow-lg">
            <Search className="h-4 w-4 text-gray-400" aria-hidden />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hanapin sa Malineng..." aria-label="Hanapin sa mapa" className="w-full bg-transparent py-2.5 outline-none" />
          </label>
          <div className="no-scrollbar pointer-events-auto flex gap-1.5 overflow-x-auto pb-1">
            {["Lahat", ...withCustomOptions(PLACE_CATEGORIES.map((c) => c.name), places.map((p) => p.category))].map((c) => {
              const on = c === category;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow ${on ? "bg-brand text-white" : "bg-white text-gray-700"}`}
                  aria-pressed={on}
                >
                  {c !== "Lahat" && <span className="h-2 w-2 rounded-full" style={{ background: categoryColor(c) }} />}
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {/* Map buttons */}
        <div className="absolute bottom-4 right-3 z-[500] flex flex-col items-end gap-2">
          {isAdmin && (
            <button onClick={saveCenter} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-brand shadow-lg">
              Gawing gitna ng mapa
            </button>
          )}
          <button onClick={locate} className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand shadow-lg" aria-label="Nasaan ako">
            <Crosshair className="h-5 w-5" />
          </button>
          <Link href="/mapa/pin" className="flex h-12 w-12 items-center justify-center rounded-full bg-gold text-brand-deep shadow-lg" aria-label="Mag-pin ng lugar">
            <Plus className="h-6 w-6" />
          </Link>
        </div>

        {loading && <p className="absolute bottom-4 left-14 z-[500] rounded-full bg-white px-3 py-1 text-xs shadow">Naglo-load ng mga pin...</p>}
      </div>

      <p className="mt-2 text-center text-xs text-gray-500">
        {visible.length} lugar sa mapa{!user && " · Mag-login para makapag-pin ng negosyo"}
      </p>
      <MyPendingPins />

      <Modal open={!!selected} onClose={() => setSelectedId(null)} title={selected?.name ?? "Lugar"}>
        {selected && <PlaceSheet p={selected} onClose={() => setSelectedId(null)} />}
      </Modal>
    </div>
  );
}

export default function MapaPage() {
  return (
    <div>
      <h1 className="sr-only">Mapa ng Malineng</h1>
      <Suspense fallback={<Spinner />}>
        <MapaContent />
      </Suspense>
    </div>
  );
}

