"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { AlertTriangle, Phone, Plus } from "lucide-react";
import { db } from "@/lib/firebase";
import { useSettings } from "@/lib/useSettings";
import { useCollection } from "@/lib/useCollection";
import {
  ACTIVE_STATUSES,
  AVAILABILITY_LABEL,
  DEFAULT_DURATION,
  DURATION_OPTIONS,
  REQUEST_STATUS_LABEL,
  addDaysISO,
  endTime,
  findConflicts,
  formatTime12,
  sortRequests,
} from "@/lib/ambulance";
import { formatDate, friendlyError, telHref, timeAgo } from "@/lib/format";
import type { AmbulanceAvailability, AmbulanceRequest, AmbulanceRequestStatus } from "@/lib/types";
import { Button, Card, EmptyState, Modal, SectionTitle, Select, Spinner, Textarea } from "@/components/ui";
import { AmbulanceForm } from "@/components/ambulance/AmbulanceForm";
import { STATUS_PILL } from "@/components/ambulance/AmbulanceTracker";
import { useToast } from "@/components/Toast";
import { AlertsSettingsCard } from "./AlertsSettingsCard";

const requestsCollection = collection(db, "ambulanceRequests");
const AVAIL_OPTIONS: AmbulanceAvailability[] = ["available", "busy", "maintenance"];
const AVAIL_BTN: Record<AmbulanceAvailability, string> = {
  available: "bg-brand text-white",
  busy: "bg-gold text-brand-dark",
  maintenance: "bg-red-600 text-white",
};

function RequestRow({ r, onOpen }: { r: AmbulanceRequest; onOpen: () => void }) {
  const hours = r.durationHours ?? DEFAULT_DURATION[r.type];
  return (
    <button onClick={onOpen} className={`w-full rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ${r.type === "emergency" && r.status === "pending" ? "ring-2 ring-red-500" : r.status === "pending" ? "ring-2 ring-gold" : "ring-gray-100"}`}>
      <div className="flex gap-3">
        <div className="w-16 shrink-0 font-black leading-tight text-brand tabular-nums">
          {formatTime12(r.time)}
          {ACTIVE_STATUSES.includes(r.status) && <span className="block text-xs font-semibold text-gray-500">– {formatTime12(endTime(r.time, hours))}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-bold">{r.type === "emergency" ? "🚨 " : ""}{r.patientName}</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_PILL[r.status]}`}>{REQUEST_STATUS_LABEL[r.status]}</span>
          </div>
          <p className="truncate text-sm text-gray-600">{r.type === "emergency" ? r.reason : `${r.reason} · ${r.pickup}${r.destination ? ` → ${r.destination}` : ""}`}</p>
          {r.driver && <p className="text-sm text-gray-500">Driver: {r.driver}</p>}
        </div>
      </div>
    </button>
  );
}

function RequestDetail({ req, all, drivers, onClose }: { req: AmbulanceRequest; all: AmbulanceRequest[]; drivers: string[]; onClose: () => void }) {
  const toast = useToast();
  const [driver, setDriver] = useState(req.driver ?? drivers[0] ?? "");
  const [hours, setHours] = useState(String(req.durationHours ?? DEFAULT_DURATION[req.type]));
  const [note, setNote] = useState(req.adminNote ?? "");
  const [busy, setBusy] = useState(false);
  const conflicts = findConflicts(all, req, Number(hours));

  /** Updates the request and keeps the public busy-window doc in sync. */
  const setStatus = async (status: AmbulanceRequestStatus) => {
    setBusy(true);
    try {
      const batch = writeBatch(db);
      const durationHours = Number(hours);
      batch.update(doc(db, "ambulanceRequests", req.id), {
        status,
        driver: driver.trim(),
        durationHours,
        adminNote: note.trim().slice(0, 500),
        updatedAt: serverTimestamp(),
      });
      const slotRef = doc(db, "ambulanceSchedule", req.id);
      if (status === "approved" || status === "enroute") {
        batch.set(slotRef, { date: req.date, start: req.time, end: endTime(req.time, durationHours), status });
      } else {
        batch.delete(slotRef);
      }
      await batch.commit();
      toast(`Status: ${REQUEST_STATUS_LABEL[status]}`);
      onClose();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Burahin nang tuluyan ang request na ito?")) return;
    try {
      await Promise.all([deleteDoc(doc(db, "ambulanceRequests", req.id)), deleteDoc(doc(db, "ambulanceSchedule", req.id))]);
      toast("Nabura.");
      onClose();
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const editable = req.status === "pending" || req.status === "approved";

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1">
        <dt className="text-gray-500">Uri</dt><dd className="font-semibold">{req.type === "emergency" ? "🚨 Emergency" : `Schedule · ${req.reason}`}</dd>
        {req.type === "emergency" && <><dt className="text-gray-500">Nangyari</dt><dd className="font-semibold">{req.reason}</dd></>}
        <dt className="text-gray-500">Pasyente</dt><dd className="font-semibold">{req.patientName}{req.purok ? ` · ${req.purok}` : ""}</dd>
        <dt className="text-gray-500">Petsa/oras</dt><dd className="font-semibold">{formatDate(req.date)} · {formatTime12(req.time)}</dd>
        <dt className="text-gray-500">Sundo</dt><dd className="font-semibold">{req.pickup}</dd>
        <dt className="text-gray-500">Pupuntahan</dt><dd className="font-semibold">{req.destination || "—"}</dd>
        {req.notes && <><dt className="text-gray-500">Paalala</dt><dd className="whitespace-pre-line font-semibold">{req.notes}</dd></>}
        <dt className="text-gray-500">Status</dt><dd><span className={`rounded-full px-2 py-0.5 text-sm font-bold ${STATUS_PILL[req.status]}`}>{REQUEST_STATUS_LABEL[req.status]}</span></dd>
        <dt className="text-gray-500">Natanggap</dt><dd>{timeAgo(req.createdAt)}</dd>
      </dl>

      <a href={telHref(req.contact)} className="flex items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-white">
        <Phone className="h-5 w-5" /> Tawagan: {req.contact}
      </a>

      {editable && (
        <>
          {conflicts.length > 0 ? (
            <div className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
              <p className="flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> May tatamaang biyahe:</p>
              <ul className="mt-1 list-disc pl-5">
                {conflicts.map((c) => (
                  <li key={c.id}>{formatTime12(c.time)}–{formatTime12(endTime(c.time, c.durationHours ?? DEFAULT_DURATION[c.type]))} · {c.patientName}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-xl bg-brand-light p-3 text-sm font-semibold text-brand">
              ✅ Walang conflict mula {formatTime12(req.time)} hanggang {formatTime12(endTime(req.time, Number(hours)))}.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {drivers.length > 0 ? (
              <Select label="Driver" options={drivers} value={driver} onChange={(e) => setDriver(e.target.value)} />
            ) : (
              <label className="block">
                <span className="mb-1 block font-semibold text-gray-800">Driver</span>
                <input value={driver} onChange={(e) => setDriver(e.target.value)} placeholder="Pangalan" className="w-full rounded-xl border-2 border-gray-200 px-4 py-3" />
              </label>
            )}
            <Select label="Tagal (oras)" options={DURATION_OPTIONS.map(String)} value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <Textarea label="Note para sa residente (optional)" placeholder="Hal. Maghanda 15 minuto bago dumating. / Dahilan ng pag-reject." value={note} onChange={(e) => setNote(e.target.value)} />
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        {req.status === "pending" && (
          <>
            <Button loading={busy} onClick={() => setStatus("approved")}>✓ Approve</Button>
            <Button variant="danger" loading={busy} onClick={() => setStatus("rejected")}>✕ Reject</Button>
          </>
        )}
        {req.status === "approved" && (
          <>
            <Button loading={busy} onClick={() => setStatus("enroute")}>🚑 Papunta na</Button>
            <Button variant="outline" loading={busy} onClick={() => setStatus("cancelled")}>I-cancel</Button>
            <Button variant="ghost" className="col-span-2" loading={busy} onClick={() => setStatus("approved")}>I-save ang pagbabago</Button>
          </>
        )}
        {req.status === "enroute" && (
          <Button className="col-span-2" loading={busy} onClick={() => setStatus("done")}>🏁 Tapos na ang biyahe</Button>
        )}
        {(req.status === "done" || req.status === "rejected" || req.status === "cancelled") && (
          <Button variant="outline" className="col-span-2" onClick={remove}>Burahin ang record</Button>
        )}
      </div>
    </div>
  );
}

export function AdminAmbulance() {
  const toast = useToast();
  const { settings } = useSettings();
  const { data, loading } = useCollection<AmbulanceRequest>(requestsCollection);
  const [day, setDay] = useState(addDaysISO(0));
  const [openId, setOpenId] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(i)), []);
  const pending = useMemo(() => sortRequests(data.filter((r) => r.status === "pending")), [data]);
  const ofDay = useMemo(
    () => sortRequests(data.filter((r) => r.date === day && r.status !== "pending")).sort((a, b) => a.time.localeCompare(b.time)),
    [data, day],
  );
  const open = data.find((r) => r.id === openId) ?? null;

  // Close the modal if the request disappears (deleted elsewhere).
  useEffect(() => {
    if (openId && !open && !loading) setOpenId(null);
  }, [openId, open, loading]);

  const setAvailability = async (status: AmbulanceAvailability) => {
    try {
      // merge:true deep-merges, so only ambulance.status changes.
      await setDoc(doc(db, "settings", "main"), { ambulance: { status } }, { merge: true });
      toast(`Ambulansya: ${AVAILABILITY_LABEL[status]}`);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <Card className="space-y-2">
        <p className="font-bold">Status ng ambulansya (makikita ng residente)</p>
        <div className="grid grid-cols-3 gap-2">
          {AVAIL_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setAvailability(s)}
              className={`rounded-xl px-2 py-2 text-sm font-bold ${settings.ambulance.status === s ? AVAIL_BTN[s] : "bg-surface text-gray-600"}`}
              aria-pressed={settings.ambulance.status === s}
            >
              {AVAILABILITY_LABEL[s].replace(" ngayon", "")}
            </button>
          ))}
        </div>
        {(!settings.ambulance.phone || settings.ambulance.drivers.length === 0) && (
          <p className="text-sm text-yellow-800">Paalala: ilagay ang numero ng ambulansya at mga driver sa tab na <b>Settings → Ambulansya</b>.</p>
        )}
      </Card>

      <div className="mt-3">
        <AlertsSettingsCard />
      </div>

      <SectionTitle>Naghihintay ng approval ({pending.length})</SectionTitle>
      {pending.length === 0 ? (
        <EmptyState title="Walang bagong request" />
      ) : (
        <div className="space-y-2">
          {pending.map((r) => (
            <div key={r.id}>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">{formatDate(r.date)}</p>
              <RequestRow r={r} onOpen={() => setOpenId(r.id)} />
            </div>
          ))}
        </div>
      )}

      <SectionTitle>Schedule</SectionTitle>
      <div className="mb-3 grid grid-cols-7 gap-1">
        {days.map((d) => {
          const date = new Date(`${d}T00:00:00`);
          const count = data.filter((r) => r.date === d && (ACTIVE_STATUSES.includes(r.status) || r.status === "pending")).length;
          const sel = d === day;
          return (
            <button key={d} onClick={() => setDay(d)} className={`rounded-xl border-2 py-1 text-center text-xs ${sel ? "border-brand bg-brand text-white" : "border-gray-200 bg-white text-gray-600"}`} aria-pressed={sel}>
              {date.toLocaleDateString("fil-PH", { weekday: "short" })}
              <b className={`block text-lg tabular-nums ${sel ? "text-white" : "text-gray-900"}`}>{date.getDate()}</b>
              <span className={`block font-bold ${sel ? "text-gold" : count ? "text-yellow-700" : "text-brand"}`}>{count ? `${count} biyahe` : "wala"}</span>
            </button>
          );
        })}
      </div>
      <label className="mb-3 block text-sm text-gray-600">
        Ibang petsa:{" "}
        <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="rounded-lg border-2 border-gray-200 px-2 py-1" />
      </label>

      {ofDay.length === 0 ? (
        <EmptyState title={`Walang biyahe sa ${formatDate(day)}`} />
      ) : (
        <div className="space-y-2">
          {ofDay.map((r) => <RequestRow key={r.id} r={r} onOpen={() => setOpenId(r.id)} />)}
        </div>
      )}

      <Button variant="gold" full className="mt-4" onClick={() => setManual(true)}>
        <Plus className="h-5 w-5" /> Manual na booking (tumawag sa telepono)
      </Button>

      <Modal open={!!open} onClose={() => setOpenId(null)} title="Request ng Ambulansya">
        {open && <RequestDetail key={open.id} req={open} all={data} drivers={settings.ambulance.drivers} onClose={() => setOpenId(null)} />}
      </Modal>

      <Modal open={manual} onClose={() => setManual(false)} title="Manual na booking">
        <p className="mb-3 text-sm text-gray-600">Para sa mga tumawag. Lalabas ito sa “Naghihintay”; i-approve doon para ma-assign ang driver.</p>
        {manual && <AmbulanceForm initialMode="schedule" onDone={() => setManual(false)} />}
      </Modal>
    </div>
  );
}
