"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc, serverTimestamp, writeBatch, type Timestamp } from "firebase/firestore";
import { MapPin, Phone, UserRound } from "lucide-react";
import { db } from "@/lib/firebase";
import { sha256Hex } from "@/lib/driverLink";
import { formatTime12 } from "@/lib/ambulance";
import { formatDate, friendlyError, telHref } from "@/lib/format";
import { Button, Card, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";

interface LinkDoc {
  requestId: string;
  driver: string;
  patientName: string;
  contact: string;
  pickup: string;
  destination: string;
  reason: string;
  type: "emergency" | "schedule";
  date: string;
  time: string;
  endTime: string;
  status: "approved" | "enroute" | "done";
  expiresAt?: Timestamp;
}

/**
 * Page for the ambulance driver. No login: the secret in the link (?t=...) is the credential.
 * The driver confirms "Papunta na" and "Tapos na", so residents see the real status.
 */
function DriverTrip() {
  const secret = (useSearchParams().get("t") ?? "").trim();
  const toast = useToast();
  const [trip, setTrip] = useState<LinkDoc | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    // Secrets are 24-64 characters; anything else cannot be a real link.
    if (secret.length < 24 || secret.length > 64) {
      setTrip(null);
      return;
    }
    try {
      const snap = await getDoc(doc(db, "ambulanceDriverLinks", secret));
      setTrip(snap.exists() ? (snap.data() as LinkDoc) : null);
    } catch {
      setTrip(null);
    }
  }, [secret]);

  useEffect(() => {
    load();
  }, [load]);

  /** Moves the trip one step. The proof (id = hash of the secret) is written in the same batch so the rules can verify it. */
  const move = async (to: "enroute" | "done") => {
    if (!trip) return;
    setBusy(true);
    try {
      const hash = await sha256Hex(secret);
      const b = writeBatch(db);
      b.set(doc(db, "ambulanceProofs", hash), { requestId: trip.requestId, secret, at: serverTimestamp() });
      b.update(doc(db, "ambulanceRequests", trip.requestId), {
        status: to,
        ...(to === "enroute" ? { enrouteAt: serverTimestamp(), enrouteBy: "driver" } : { doneAt: serverTimestamp(), doneBy: "driver" }),
        updatedAt: serverTimestamp(),
      });
      b.update(doc(db, "ambulanceDriverLinks", secret), { status: to, ...(to === "enroute" ? { enrouteAt: serverTimestamp() } : { doneAt: serverTimestamp() }) });
      if (to === "enroute") b.update(doc(db, "ambulanceSchedule", trip.requestId), { status: "enroute" });
      else b.delete(doc(db, "ambulanceSchedule", trip.requestId));
      await b.commit();
      toast(to === "enroute" ? "Naipaalam na sa residente: papunta na ang ambulansya." : "Salamat! Natapos na ang biyahe.");
      await load();
    } catch (err) {
      // Most likely the trip was cancelled, the driver was changed, or the link expired.
      toast(`${friendlyError(err)} Kung hindi ito gumagana, tawagan ang barangay.`, "error");
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (trip === undefined) return <Spinner />;
  const expired = !!trip?.expiresAt && trip.expiresAt.toDate().getTime() < Date.now();
  if (!trip || expired) {
    return (
      <Card className="mt-4 space-y-2 text-center">
        <p className="text-4xl">🚫</p>
        <p className="font-bold">Hindi na valid ang link na ito.</p>
        <p className="text-sm text-gray-600">Maaaring nagbago ang driver, na-cancel ang biyahe, o tapos na. Tawagan ang barangay para sa bagong link.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <p className="text-sm font-bold uppercase tracking-wide text-gray-500">{trip.type === "emergency" ? "🚨 Emergency" : "Naka-schedule"}</p>
        <p className="flex items-center gap-2 text-lg font-extrabold"><UserRound className="h-5 w-5 text-brand" /> {trip.patientName}</p>
        <p className="text-gray-700">{formatDate(trip.date)} · {formatTime12(trip.time)}–{formatTime12(trip.endTime)}</p>
        <p className="text-sm text-gray-600">{trip.reason}</p>
        <div className="space-y-1 rounded-xl bg-surface p-3">
          <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand" /><span><b>Sundo:</b> {trip.pickup}</span></p>
          <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-red-500" /><span><b>Pupuntahan:</b> {trip.destination || "—"}</span></p>
        </div>
        <a href={telHref(trip.contact)} className="flex items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-white">
          <Phone className="h-5 w-5" /> Tawagan ang pasyente: {trip.contact}
        </a>
      </Card>

      {trip.status === "approved" && (
        <Button full loading={busy} onClick={() => move("enroute")} className="py-4 text-lg">🚑 Papunta na ako</Button>
      )}
      {trip.status === "enroute" && (
        <>
          <p className="rounded-xl bg-blue-50 p-3 text-center font-semibold text-blue-800">Papunta ka na. Pindutin ang button sa ibaba kapag tapos na ang biyahe.</p>
          <Button full loading={busy} onClick={() => move("done")} className="py-4 text-lg">🏁 Tapos na ang biyahe</Button>
        </>
      )}
      {trip.status === "done" && <p className="rounded-xl bg-brand-light p-4 text-center font-bold text-brand">✅ Tapos na ang biyaheng ito. Salamat po!</p>}
      <p className="text-center text-xs text-gray-500">Ang link na ito ay para lang sa iyo. Huwag ibahagi.</p>
    </div>
  );
}

export default function DriverPage() {
  return (
    <div>
      <PageHeader title="Biyahe ng ambulansya" subtitle="Para sa driver" />
      <Suspense fallback={<Spinner />}>
        <DriverTrip />
      </Suspense>
    </div>
  );
}
