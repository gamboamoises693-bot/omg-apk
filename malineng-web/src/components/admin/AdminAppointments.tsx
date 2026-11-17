"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { FileText, Phone, Printer, Trash2, UserPlus } from "lucide-react";
import { setHallPrefill } from "@/lib/hallPrefill";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/lib/useSettings";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from "@/lib/constants";
import { formatDate, friendlyError, telHref } from "@/lib/format";
import type { Appointment } from "@/lib/types";
import { Badge, Button, Card, EmptyState, FilterTabs, Input, Modal, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { ModerationApproval } from "@/components/ModerationApproval";

const appointmentsCollection = collection(db, "appointments");
const PRINTABLE = ["Barangay Clearance", "Indigency"] as const;

/** Creates issuedDocuments/{id} (public QR check) and links it to the appointment. */
function IssueDocument({ a, onClose }: { a: Appointment; onClose: () => void }) {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();
  const [purpose, setPurpose] = useState(a.notes?.trim() || "");
  const [busy, setBusy] = useState(false);
  const punong = settings.officials.find((o) => /punong/i.test(o.position))?.name ?? "";

  const issue = async () => {
    setBusy(true);
    try {
      const userSnap = await getDoc(doc(db, "users", a.userId));
      const purok = (userSnap.exists() && (userSnap.data().purok as string)) || "Barangay Malineng";
      const ref = await addDoc(collection(db, "issuedDocuments"), {
        type: a.service === "Indigency" ? "Indigency" : "Barangay Clearance",
        fullName: a.fullName,
        purok,
        purpose: purpose.trim().slice(0, 200),
        appointmentId: a.id,
        issuedByName: profile?.fullName ?? "",
        signatory: punong,
        valid: true,
        issuedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "appointments", a.id), { documentId: ref.id });
      logActivity("Dokumento", `Gumawa ng ${a.service} para kay ${a.fullName}`, ref.id);
      // Same-tab navigation: a popup opened after an await is often blocked on phones.
      window.location.assign(`/dokumento/?id=${ref.id}`);
      onClose();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Gagawa ng {a.service} para kay <b>{a.fullName}</b>, na may QR code na pwedeng i-scan para makumpirmang totoo ito.</p>
      <Input label="Layunin (purpose)" placeholder="Hal. employment, scholarship, bank requirement" value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={200} />
      {!punong && <p className="rounded-xl bg-gold-light p-2.5 text-xs text-yellow-900">Wala pang “Punong Barangay” sa Settings → Mga Opisyal. Blangko ang pirma.</p>}
      <Button full loading={busy} onClick={issue}><FileText className="h-4 w-4" /> Gumawa at i-print</Button>
    </div>
  );
}

interface PortalRequest {
  id: string; // = mobile number
  fullName: string;
  contact: string;
  purok: string;
  date: string;
  notes: string;
  createdAt?: import("firebase/firestore").Timestamp;
}

/** People WITHOUT an account who asked (no login) for a visit to be registered in the Malineng Portal. */
function PortalRequests() {
  const { isSuperAdmin, isAdmin, profile } = useAuth();
  const toast = useToast();
  const { data, loading } = useCollection<PortalRequest>(useMemo(() => collection(db, "portalRequests"), []));
  const list = useMemo(() => [...data].sort((a, b) => a.date.localeCompare(b.date)), [data]);
  // Same people the rules allow to register others (Kapitan, Secretary, Developer).
  const canRegister = isSuperAdmin || (isAdmin && ["Kapitan", "Secretary"].includes(profile?.position ?? ""));
  if (loading || list.length === 0) return null;

  const register = (r: PortalRequest) => {
    setHallPrefill({ fullName: r.fullName, contact: r.contact, purok: r.purok, requestId: r.id });
    window.location.hash = "hallregister";
  };
  const done = async (r: PortalRequest) => {
    if (!window.confirm(`Tanggalin ang request ni ${r.fullName}?`)) return;
    try {
      await deleteDoc(doc(db, "portalRequests", r.id));
      logActivity("Appointments", `Tinanggal ang request sa rehistro: ${r.fullName}`, r.id);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <section className="mb-4 space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-extrabold"><UserPlus className="h-4 w-4" aria-hidden /> Rehistro sa Malineng Portal: walang account ({list.length})</h3>
      {list.map((r) => (
        <Card key={r.id} className="space-y-2 ring-1 ring-gold/50">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="break-words font-bold">{r.fullName}</p>
              <p className="text-sm text-gray-600">{r.purok} · pupunta sa {formatDate(r.date)}</p>
              {r.notes && <p className="text-xs text-gray-500">{r.notes}</p>}
            </div>
            <a href={telHref(r.contact)} className="flex shrink-0 items-center gap-1 rounded-full bg-brand-light px-3 py-1.5 text-xs font-bold text-brand"><Phone className="h-3.5 w-3.5" aria-hidden /> {r.contact}</a>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {canRegister ? <Button onClick={() => register(r)}>Irehistro ngayon</Button> : <p className="self-center text-xs text-gray-500">Kapitan o Secretary ang magre-register.</p>}
            <Button variant="outline" onClick={() => done(r)}>Tanggalin</Button>
          </div>
        </Card>
      ))}
    </section>
  );
}

export function AdminAppointments() {
  const toast = useToast();
  const [filter, setFilter] = useState<AppointmentStatus | "lahat">("natanggap");
  const { data, loading } = useCollection<Appointment>(appointmentsCollection);
  const [issuing, setIssuing] = useState<Appointment | null>(null);

  const items = useMemo(
    () => data.filter((a) => filter === "lahat" || a.status === filter).sort((a, b) => a.date.localeCompare(b.date)),
    [data, filter],
  );

  const setStatus = async (id: string, status: AppointmentStatus) => {
    try {
      await updateDoc(doc(db, "appointments", id), { status });
      const a = data.find((x) => x.id === id);
      logActivity("Appointments", `${a?.service ?? "Appointment"} ni ${a?.fullName ?? ""}: ${APPOINTMENT_STATUS_LABEL[status].split(" —")[0]}`, id);
      toast(`Status: ${APPOINTMENT_STATUS_LABEL[status]}`);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Burahin ang appointment record na ito?")) return;
    try {
      await deleteDoc(doc(db, "appointments", id));
      logActivity("Appointments", "Nagbura ng appointment record", id);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <div>
      <PortalRequests />
      <FilterTabs
        label="Status ng appointment"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "natanggap", label: "Bago", count: data.filter((a) => a.status === "natanggap").length },
          { value: "nasa_kagawad", label: "Kagawad", count: data.filter((a) => a.status === "nasa_kagawad").length, tone: "neutral" },
          { value: "ready", label: "Ready", count: data.filter((a) => a.status === "ready").length, tone: "neutral" },
          { value: "lahat", label: "Lahat", count: data.length, tone: "neutral" },
        ]}
      />
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title="Walang appointment dito" />
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge color="gold">{a.service}</Badge>
                  <p className="mt-1 text-base font-bold">{a.fullName}</p>
                  <p className="text-gray-600">{formatDate(a.date)} · Ref {a.id.slice(0, 8).toUpperCase()}</p>
                  {a.notes && <p className="mt-1 whitespace-pre-line text-gray-700">{a.notes}</p>}
                </div>
                <div className="flex gap-1">
                  <a href={telHref(a.contact)} className="rounded-full bg-brand p-2 text-white" aria-label="Tawagan"><Phone className="h-5 w-5" /></a>
                  <button onClick={() => remove(a.id)} className="rounded-full p-2 text-gray-400" aria-label="Burahin"><Trash2 className="h-5 w-5" /></button>
                </div>
              </div>
              {a.status === "ready" ? (
                <p className="mt-3 rounded-xl bg-green-50 px-4 py-3 font-semibold text-green-800">{APPOINTMENT_STATUS_LABEL.ready}</p>
              ) : (
                <>
                  <select
                    value={a.status}
                    onChange={(e) => setStatus(a.id, e.target.value as AppointmentStatus)}
                    className="mt-3 w-full rounded-xl border-2 border-gray-200 px-4 py-3 font-semibold"
                    aria-label="Status"
                  >
                    {APPOINTMENT_STATUSES.filter((s) => s !== "ready").map((s) => (
                      <option key={s} value={s}>{APPOINTMENT_STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                  <div className="mt-3">
                    <ModerationApproval collectionName="appointments" item={a} actionKey="dok" releasedStatus="ready" rejectable={false} tab="Appointments" what={`${a.service} ni ${a.fullName}`} releaseLabel="Ready na (pwede nang kunin)" />
                  </div>
                </>
              )}
              {a.status === "ready" && (PRINTABLE as readonly string[]).includes(a.service) && (
                a.documentId ? (
                  <Link href={`/dokumento/?id=${a.documentId}`} target="_blank" className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-brand-light py-2.5 text-sm font-bold text-brand">
                    <Printer className="h-4 w-4" /> I-print ulit ang dokumento
                  </Link>
                ) : (
                  <Button variant="soft" full className="mt-2" onClick={() => setIssuing(a)}><FileText className="h-4 w-4" /> Gumawa ng dokumento (may QR)</Button>
                )
              )}
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!issuing} onClose={() => setIssuing(null)} title="Gumawa ng dokumento">
        {issuing && <IssueDocument a={issuing} onClose={() => setIssuing(null)} />}
      </Modal>
    </div>
  );
}
