"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { collection, deleteDoc, doc, query, setDoc, where } from "firebase/firestore";
import { Clock, Crosshair, List, Map as MapIcon, MapPin, MessageCircle, Navigation, PenLine, Phone, Plus, Search, Trash2, Undo2, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { useSettings } from "@/lib/useSettings";
import { logActivity } from "@/lib/activity";
import { friendlyError, telHref, withCustomOptions } from "@/lib/format";
import { DEFAULT_MAP_CENTER, EVACUATION, PLACE_CATEGORIES, categoryColor, directionsUrl, distanceMeters, formatDistance, type Place } from "@/lib/places";
import { LeafletMap, type LatLng, type MapHandle } from "@/components/map/LeafletMap";
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

/** Small card at the bottom of the map for the tapped pin (the full details open in a sheet). */
function PlacePeek({ p, distance, onMore, onClose }: { p: Place; distance: number | null; onMore: () => void; onClose: () => void }) {
  return (
    <div className="absolute inset-x-3 bottom-3 z-[600] rounded-[1.4rem] bg-white p-3.5 shadow-[0_14px_30px_-10px_rgba(15,23,42,0.45)]">
      <button type="button" onClick={onClose} aria-label="Isara" className="absolute right-2.5 top-2.5 rounded-full bg-gray-100 p-1.5 text-gray-600 active:bg-gray-200">
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-3 pr-7">
        {p.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.photo} alt={p.name} className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
        ) : (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: categoryColor(p.category) }}>
            <MapPin className="h-8 w-8" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <span className="inline-block rounded-full px-2.5 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wide text-white" style={{ background: categoryColor(p.category) }}>{p.category}</span>
          <p className="mt-1 truncate text-base font-extrabold">{p.name}</p>
          <p className="truncate text-xs text-gray-600">
            {[p.purok, p.hours, distance !== null ? formatDistance(distance) : ""].filter(Boolean).join(" · ") || "Barangay Malineng"}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <a href={directionsUrl(p)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-brand to-brand-dark py-2.5 text-[0.8rem] font-bold text-white">
          <Navigation className="h-4 w-4" aria-hidden /> Direksyon
        </a>
        {p.contact ? (
          <a href={telHref(p.contact)} className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-light py-2.5 text-[0.8rem] font-bold text-brand-dark">
            <Phone className="h-4 w-4" aria-hidden /> Tawagan
          </a>
        ) : (
          <span className="flex items-center justify-center rounded-xl bg-gray-50 py-2.5 text-[0.75rem] text-gray-400">Walang contact</span>
        )}
        <button type="button" onClick={onMore} className="rounded-xl border-[1.5px] border-[#C9D4E5] py-2.5 text-[0.8rem] font-bold text-brand-dark active:bg-brand-light">
          Detalye
        </button>
      </div>
    </div>
  );
}

function CategoryChips({ places, category, setCategory }: { places: Place[]; category: string; setCategory: (c: string) => void }) {
  return (
    <div className="no-scrollbar pointer-events-auto flex gap-1.5 overflow-x-auto pb-1">
      {["Lahat", ...withCustomOptions(PLACE_CATEGORIES.map((c) => c.name), places.map((p) => p.category))].map((c) => {
        const on = c === category;
        return (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold shadow-[0_2px_6px_rgba(15,23,42,0.18)] ${on ? "bg-brand-deep text-white" : "bg-white text-brand-deep"}`}
            aria-pressed={on}
          >
            {c !== "Lahat" && !on && <span className="h-2 w-2 rounded-full" style={{ background: categoryColor(c) }} />}
            {c}
          </button>
        );
      })}
    </div>
  );
}

function MapaContent() {
  const params = useSearchParams();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const toast = useToast();
  const { settings, loading: settingsLoading } = useSettings();
  const { data: places, loading } = useCollection<Place>(approvedQ);
  const mapRef = useRef<MapHandle>(null);
  const [category, setCategory] = useState("Lahat");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(params.get("id"));
  const [detail, setDetail] = useState(false);
  const [view, setView] = useState<"mapa" | "listahan">("mapa");
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  // Super Admin: drawing the Barangay boundary by tapping its corners.
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<LatLng[]>([]);

  const center = settings.mapCenter ?? DEFAULT_MAP_CENTER;
  const visible = useMemo(() => {
    const t = search.trim().toLowerCase();
    return places.filter((p) => (category === "Lahat" || p.category === category) && (!t || `${p.name} ${p.description} ${p.purok}`.toLowerCase().includes(t)));
  }, [places, category, search]);
  const selected = places.find((p) => p.id === selectedId) ?? null;
  const distanceOf = (p: Place) => (userPos ? distanceMeters(userPos, p) : null);
  // The list shows the nearest first once the phone's location is known, otherwise by name.
  const sorted = useMemo(
    () => [...visible].sort((a, b) => (userPos ? distanceMeters(userPos, a) - distanceMeters(userPos, b) : a.name.localeCompare(b.name))),
    [visible, userPos],
  );

  // Deep link (/mapa?id=...): fly to the pin once it has loaded.
  const flewTo = useRef(false);
  useEffect(() => {
    if (flewTo.current || !selected) return;
    flewTo.current = true;
    mapRef.current?.flyTo(selected.lat, selected.lng, 17);
  }, [selected]);

  const locate = (andList = false) => {
    if (!navigator.geolocation) return toast("Hindi suportado ng phone ang GPS.", "error");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(here);
        if (!andList) mapRef.current?.flyTo(here.lat, here.lng, 17);
      },
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

  const saveBoundary = async (points: LatLng[]) => {
    try {
      await setDoc(doc(db, "settings", "main"), { mapBoundary: points }, { merge: true });
      logActivity("Settings", points.length ? "Ginuhit ang hangganan ng Barangay Malineng sa mapa" : "Inalis ang hangganan ng Barangay sa mapa");
      toast(points.length ? "Na-save ang hangganan ng Malineng." : "Naalis ang hangganan.");
      setDrawing(false);
      setDraft([]);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  // Wait for settings so the map opens on the saved center.
  if (settingsLoading) return <Spinner />;

  if (view === "listahan") {
    return (
      <div className="space-y-3 pb-4">
        <div className="flex items-center gap-2 rounded-2xl bg-white px-4 shadow-card">
          <Search className="h-4 w-4 text-gray-400" aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hanapin sa Malineng..." aria-label="Hanapin sa mapa" className="w-full bg-transparent py-3 outline-none" />
        </div>
        <CategoryChips places={places} category={category} setCategory={setCategory} />
        {!userPos && (
          <button type="button" onClick={() => locate(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-light py-3 text-sm font-bold text-brand-dark active:brightness-95">
            <Crosshair className="h-4 w-4" aria-hidden /> Ayusin ayon sa pinakamalapit sa akin
          </button>
        )}
        <div className="divide-y divide-line overflow-hidden rounded-[1.125rem] border border-line bg-white shadow-card">
          {sorted.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">Walang nahanap na lugar.</p>
          ) : (
            sorted.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedId(p.id);
                  setView("mapa");
                  setTimeout(() => mapRef.current?.flyTo(p.lat, p.lng, 18), 250);
                }}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-gray-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white" style={{ background: categoryColor(p.category) }}>
                  <MapPin className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{p.name}</span>
                  <span className="block truncate text-xs text-gray-600">{[p.category, p.purok].filter(Boolean).join(" · ")}</span>
                </span>
                {distanceOf(p) !== null && <span className="shrink-0 text-xs font-extrabold text-brand-dark">{formatDistance(distanceOf(p)!)}</span>}
              </button>
            ))
          )}
        </div>
        <button type="button" onClick={() => setView("mapa")} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-brand to-brand-dark py-3 font-bold text-white">
          <MapIcon className="h-4 w-4" aria-hidden /> Bumalik sa mapa
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative -mx-4 h-[calc(100dvh-13rem)] min-h-[22rem] overflow-hidden">
        <LeafletMap
          ref={mapRef}
          center={center}
          places={visible}
          selectedId={selectedId}
          onSelect={(p) => {
            if (!drawing) setSelectedId(p.id);
          }}
          onMapClick={(lat, lng) => (drawing ? setDraft((d) => [...d, { lat, lng }]) : setSelectedId(null))}
          boundary={settings.mapBoundary}
          draft={drawing ? draft : undefined}
          userPos={userPos}
          className="absolute inset-0"
        />

        {/* Search + category chips over the map */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] space-y-2">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white pl-4 pr-1.5 shadow-[0_6px_16px_-6px_rgba(15,23,42,0.35)]">
            <Search className="h-4 w-4 text-gray-400" aria-hidden />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hanapin sa Malineng..." aria-label="Hanapin sa mapa" className="w-full bg-transparent py-2.5 outline-none" />
            <button type="button" onClick={() => setView("listahan")} aria-label="Ipakita bilang listahan" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand active:brightness-95">
              <List className="h-4 w-4" />
            </button>
          </div>
          <CategoryChips places={places} category={category} setCategory={setCategory} />
        </div>

        {/* Map buttons */}
        {!selected && !drawing && (
          <div className="absolute bottom-4 right-3 z-[500] flex flex-col items-end gap-2">
            {isAdmin && (
              <button onClick={saveCenter} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-brand shadow-lg">
                Gawing gitna ng mapa
              </button>
            )}
            {isSuperAdmin && (
              <button
                onClick={() => {
                  setDraft([]);
                  setDrawing(true);
                  toast("Pindutin ang bawat sulok ng hangganan ng Malineng.");
                }}
                className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-bold text-brand-deep shadow-lg"
              >
                <PenLine className="h-3.5 w-3.5" aria-hidden /> {settings.mapBoundary?.length ? "Palitan ang hangganan" : "Iguhit ang hangganan"}
              </button>
            )}
            <button onClick={() => locate()} className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand shadow-lg" aria-label="Nasaan ako">
              <Crosshair className="h-5 w-5" />
            </button>
            <Link href="/mapa/pin" className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-[#E3C25A] to-gold text-brand-deep shadow-lg" aria-label="Mag-pin ng lugar">
              <Plus className="h-6 w-6" />
            </Link>
          </div>
        )}

        {/* Boundary drawing toolbar */}
        {drawing && (
          <div className="absolute inset-x-3 bottom-3 z-[600] space-y-2 rounded-[1.4rem] bg-white p-3.5 shadow-[0_14px_30px_-10px_rgba(15,23,42,0.45)]">
            <p className="text-sm font-bold text-brand-deep">Iguhit ang hangganan ng Malineng</p>
            <p className="text-xs text-gray-600">Pindutin ang mga sulok ng barangay nang paikot. {draft.length} puntos. Kailangan ng hindi bababa sa 3.</p>
            <div className="grid grid-cols-4 gap-2">
              <button type="button" onClick={() => setDraft((d) => d.slice(0, -1))} disabled={!draft.length} className="flex items-center justify-center gap-1 rounded-xl bg-gray-100 py-2.5 text-xs font-bold disabled:opacity-40" aria-label="Alisin ang huling punto">
                <Undo2 className="h-4 w-4" /> Undo
              </button>
              <button type="button" onClick={() => { setDrawing(false); setDraft([]); }} className="rounded-xl bg-gray-100 py-2.5 text-xs font-bold">Kanselahin</button>
              <button type="button" onClick={() => { if (confirm("Alisin ang hangganan sa mapa?")) saveBoundary([]); }} className="rounded-xl bg-red-50 py-2.5 text-xs font-bold text-red-700">Alisin</button>
              <button type="button" disabled={draft.length < 3} onClick={() => saveBoundary(draft)} className="rounded-xl bg-gradient-to-b from-brand to-brand-dark py-2.5 text-xs font-bold text-white disabled:opacity-40">I-save</button>
            </div>
          </div>
        )}

        {selected && !drawing && <PlacePeek p={selected} distance={distanceOf(selected)} onMore={() => setDetail(true)} onClose={() => setSelectedId(null)} />}

        {loading && <p className="absolute bottom-4 left-14 z-[500] rounded-full bg-white px-3 py-1 text-xs shadow">Naglo-load ng mga pin...</p>}
      </div>

      <p className="mt-2 text-center text-xs text-gray-500">
        {visible.length} lugar sa mapa{!user && " · Mag-login para makapag-pin ng negosyo"}
      </p>
      <MyPendingPins />

      <Modal open={!!selected && detail} onClose={() => setDetail(false)} title={selected?.name ?? "Lugar"}>
        {selected && <PlaceSheet p={selected} onClose={() => { setDetail(false); setSelectedId(null); }} />}
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

