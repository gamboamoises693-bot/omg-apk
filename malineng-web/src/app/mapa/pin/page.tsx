"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Camera, Crosshair } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/lib/useSettings";
import { logActivity } from "@/lib/activity";
import { compressToDataUrl } from "@/lib/upload";
import { friendlyError } from "@/lib/format";
import { DEFAULT_MAP_CENTER, EVACUATION, PLACE_CATEGORIES, type Place } from "@/lib/places";
import { LeafletMap, type MapHandle } from "@/components/map/LeafletMap";
import { Button, ErrorText, Input, PageHeader, Select, Spinner } from "@/components/ui";
import { RequireVerified } from "@/components/RequireVerified";
import { useToast } from "@/components/Toast";

function PinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("id");
  const { user, profile, isAdmin } = useAuth();
  const toast = useToast();
  const { settings, loading: settingsLoading } = useSettings();
  const mapRef = useRef<MapHandle>(null);

  const [existing, setExisting] = useState<Place | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(!!editId);
  const [view, setView] = useState(settings.mapCenter ?? DEFAULT_MAP_CENTER);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(PLACE_CATEGORIES[0].name);
  const [purok, setPurok] = useState(profile?.purok ?? "");
  const [hours, setHours] = useState("");
  const [contact, setContact] = useState(profile?.contact ?? "");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Edit mode: load the pin and move the map to it.
  useEffect(() => {
    if (!editId) return;
    getDoc(doc(db, "places", editId))
      .then((snap) => {
        if (!snap.exists()) return setError("Wala na ang pin na ito.");
        const p = { id: snap.id, ...snap.data() } as Place;
        setExisting(p);
        setName(p.name);
        setCategory(p.category);
        setPurok(p.purok);
        setHours(p.hours);
        setContact(p.contact);
        setDescription(p.description);
        setPhoto(p.photo);
        setView({ lat: p.lat, lng: p.lng, zoom: 18 });
        mapRef.current?.flyTo(p.lat, p.lng, 18);
      })
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoadingDoc(false));
  }, [editId]);

  const categories = PLACE_CATEGORIES.map((c) => c.name).filter((c) => isAdmin || c !== EVACUATION);

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => mapRef.current?.flyTo(pos.coords.latitude, pos.coords.longitude, 18),
      () => toast("Hindi makuha ang lokasyon. Buksan ang GPS at payagan ang website.", "error"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    try {
      setPhoto(await compressToDataUrl(file, 640, 0.7, 140_000));
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const save = async () => {
    if (!user || !profile) return;
    setError("");
    if (!name.trim()) return setError("Ilagay ang pangalan ng lugar.");
    const v = mapRef.current?.getView() ?? view;
    const data = {
      name: name.trim().slice(0, 80),
      category,
      purok,
      hours: hours.trim().slice(0, 80),
      contact: contact.trim().slice(0, 40),
      description: description.trim().slice(0, 300),
      photo,
      lat: Number(v.lat.toFixed(6)),
      lng: Number(v.lng.toFixed(6)),
    };
    setBusy(true);
    try {
      if (existing) {
        // Admin edits stay approved; an owner's edit goes back for review.
        const status = isAdmin ? existing.status : "pending";
        await updateDoc(doc(db, "places", existing.id), { ...data, status, ownerId: existing.ownerId });
        logActivity("Mapa", `Inayos ang pin: ${data.name}`, existing.id);
        toast(status === "pending" ? "Na-save. Susuriin ulit ng Barangay." : "Na-save ang pin.");
      } else {
        const ref = await addDoc(collection(db, "places"), {
          ...data,
          status: isAdmin ? "approved" : "pending",
          ownerId: user.uid,
          ownerName: profile.fullName,
          createdAt: serverTimestamp(),
        });
        logActivity("Mapa", `Nag-pin ng ${data.category}: ${data.name}`, ref.id);
        toast(isAdmin ? "Nasa mapa na." : "Naipadala. Lalabas sa mapa pagka-approve ng Barangay.");
      }
      router.push("/mapa");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  if (settingsLoading || loadingDoc) return <Spinner />;

  return (
    <div>
      <div className="relative -mx-4 h-72 overflow-hidden">
        <LeafletMap ref={mapRef} center={view} onMoveEnd={setView} className="absolute inset-0" />
        {/* Fixed pin in the middle: the map moves under it. */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-[500] block h-9 w-9 -translate-x-1/2 -translate-y-full rotate-[-45deg] rounded-[999px_999px_999px_0] border-[3px] border-white bg-red-600 shadow-lg"
          style={{ transformOrigin: "center", marginTop: "-4px" }}
        />
        <button onClick={locate} className="absolute bottom-3 right-3 z-[500] flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand shadow-lg" aria-label="Nasaan ako">
          <Crosshair className="h-5 w-5" />
        </button>
        <p className="pointer-events-none absolute bottom-3 left-1/2 z-[500] -translate-x-1/2 whitespace-nowrap rounded-full bg-gray-900/85 px-3 py-1.5 text-xs font-semibold text-white">
          I-drag ang mapa para itapat ang pin
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <Input label="Pangalan ng lugar" placeholder="hal. Aling Nena Sari-sari Store" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <div className="grid grid-cols-2 gap-2">
          <Select label="Kategorya" options={categories} value={category} onChange={(e) => setCategory(e.target.value)} />
          <Select label="Purok" options={settings.puroks} placeholder="Piliin" value={purok} onChange={(e) => setPurok(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input label="Oras" placeholder="6:00 AM – 9:00 PM" value={hours} onChange={(e) => setHours(e.target.value)} maxLength={80} />
          <Input label="Contact" type="tel" inputMode="tel" placeholder="09xx..." value={contact} onChange={(e) => setContact(e.target.value)} maxLength={40} />
        </div>
        <Input
          label={category === EVACUATION ? "Detalye (ilang pamilya ang kasya, atbp.)" : "Ano ang meron (optional)"}
          placeholder={category === EVACUATION ? "hal. Kasya ang 50 pamilya, may CR at tubig" : "hal. Bigas, load, de-lata, yelo"}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
        />
        <label className="block cursor-pointer">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Litrato ng lugar" className="aspect-video w-full rounded-2xl object-cover" />
          ) : (
            <span className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/30 bg-brand-light py-3 text-sm font-bold text-brand">
              <Camera className="h-4 w-4" /> Litrato ng lugar (optional)
            </span>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {photo && <button onClick={() => setPhoto("")} className="text-xs font-semibold text-red-700">Alisin ang litrato</button>}
        {!isAdmin && <p className="text-xs text-gray-500">Lalabas ito sa mapa pagka-approve ng Barangay.</p>}
        <ErrorText>{error}</ErrorText>
        <Button full loading={busy} onClick={save}>{isAdmin ? "I-save sa mapa" : "Ipadala para i-approve"}</Button>
      </div>
    </div>
  );
}

export default function PinPage() {
  return (
    <div>
      <PageHeader title="Mag-pin ng lugar" subtitle="Negosyo, establisimyento o pasilidad sa Malineng" />
      <RequireVerified feature="makapag-pin sa mapa">
        <Suspense fallback={<Spinner />}>
          <PinForm />
        </Suspense>
      </RequireVerified>
    </div>
  );
}
