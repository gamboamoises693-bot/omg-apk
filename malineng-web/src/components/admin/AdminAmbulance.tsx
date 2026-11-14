"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
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
import type { AmbulanceAvailability, AmbulanceRequest, AmbulanceRequestStatus, AmbulanceSettings } from "@/lib/types";
import { Button, Card, EmptyState, Modal, SectionTitle, Select, Spinner, Textarea } from "@/components/ui";
import { AmbulanceForm } from "@/components/ambulance/AmbulanceForm";
import { STATUS_PILL } from "@/components/ambulance/AmbulanceTracker";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { logActivity } from "@/lib/activity";
import { ApprovalPanel } from "@/components/ApprovalPanel";
import { ApprovalTracker } from "@/components/ApprovalTracker";
import { advanceRequest, newEntry, returnRequest, withEntry, type Actor } from "@/lib/approval";
import { effectiveSteps, useApprovalConfig } from "@/lib/approvalConfig";
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

const OTHER_DRIVER = "__other__";

function RequestDetail({ req, all, drivers, ambulance, onClose }: { req: AmbulanceRequest; all: AmbulanceRequest[]; drivers: string[]; ambulance: AmbulanceSettings; onClose: () => void }) {
  const { isKapitan, isAdmin } = useAuth();
  const toast = useToast();
  // No driver is pre-selected: it must be chosen on purpose before the request is endorsed.
  const [driver, setDriver] = useState(req.driver ?? "");
  // A substitute driver who is not on the list (e.g. a volunteer) can be typed in when nobody on the list is available.
  const [other, setOther] = useState(!!req.driver && drivers.length > 0 && !drivers.includes(req.driver));
  const off = new Set(ambulance.offDrivers ?? []);
  const availableDrivers = drivers.filter((d) => !off.has(d));
  const driverUnavailable = !other && !!driver && off.has(driver);
  const suggestion = availableDrivers.find((d) => d !== driver);
  const [hours, setHours] = useState(String(req.durationHours ?? DEFAULT_DURATION[req.type]));
  const [note, setNote] = useState(req.adminNote ?? "");
  const [busy, setBusy] = useState(false);
  const conflicts = findConflicts(all, req, Number(hours));
  // Who approves (set by the Developer): emergencies and scheduled trips can have different steps.
  const approvals = useApprovalConfig();
  const cfgKey = req.type === "emergency" ? "ambe" : "amb";
  const steps = effectiveSteps(approvals[cfgKey]);

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
      logActivity("Ambulansya", `${req.type === "emergency" ? "🚨 " : ""}${req.patientName} (${req.date} ${formatTime12(req.time)}): ${REQUEST_STATUS_LABEL[status]}${driver.trim() ? ` · Driver: ${driver.trim()}` : ""}`, req.id);
      toast(`Status: ${REQUEST_STATUS_LABEL[status]}`);
      onClose();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  /** Kapitan's release (or the emergency "agaran" release): approves, saves driver and hours, and opens the public busy window. */
  const release = async (actor: Actor, noteText: string, fast: boolean) => {
    const batch = writeBatch(db);
    const durationHours = Number(hours);
    batch.update(doc(db, "ambulanceRequests", req.id), {
      status: "approved",
      ...(fast ? { urgent: true } : {}),
      trail: withEntry(req.trail, newEntry(fast ? "fast" : "release", actor, noteText)),
      driver: driver.trim(),
      durationHours,
      adminNote: note.trim().slice(0, 500),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, "ambulanceSchedule", req.id), { date: req.date, start: req.time, end: endTime(req.time, durationHours), status: "approved" });
    await batch.commit();
    logActivity("Ambulansya", `${fast ? "AGARAN " : ""}Inilabas: ${req.patientName} (${req.date} ${formatTime12(req.time)})${driver.trim() ? ` · Driver: ${driver.trim()}` : ""}`, req.id);
  };

  /** Runs one approval action with a toast and closes the dialog. */
  const step = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn();
      toast(ok);
      onClose();
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const remove = async () => {
    if (!confirm("Burahin nang tuluyan ang request na ito?")) return;
    try {
      await Promise.all([deleteDoc(doc(db, "ambulanceRequests", req.id)), deleteDoc(doc(db, "ambulanceSchedule", req.id))]);
      logActivity("Ambulansya", `Nagbura ng ambulance request ni ${req.patientName}`, req.id);
      toast("Nabura.");
      onClose();
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  // The driver and the hours are set while the request is still waiting (before the first approver endorses it); Kapitan can still change them after release.
  const editable = (isAdmin && req.status === "pending") || (isKapitan && req.status === "approved");

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
          <div className="rounded-xl bg-surface p-3 text-sm">
            <p className="font-bold">🚑 Ambulansya ng Barangay</p>
            <p className="text-gray-700">
              {ambulance.phone ? <a href={telHref(ambulance.phone)} className="font-semibold text-brand underline">{ambulance.phone}</a> : "Walang numero sa Settings"} · {ambulance.fee || "Libre"} · {AVAILABILITY_LABEL[ambulance.status]}
            </p>
            {req.status === "pending" && <p className="mt-1 text-xs text-gray-600">Piliin ang <b>Driver</b> (mula sa listahan sa Settings ng Ambulansya) at ang tagal bago mag-endorso. Nakikita ito ng mga susunod na approver at ng residente.</p>}
          </div>
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
          {drivers.length > 0 && availableDrivers.length === 0 && !other && (
            <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
              Walang available na driver ngayon. Piliin ang <b>&quot;Ibang driver (pamalit)&quot;</b>, o ilipat ang biyahe sa ibang oras (tawagan ang residente).
            </p>
          )}
          {driverUnavailable && (
            <div className="space-y-2 rounded-xl bg-yellow-50 p-3 text-sm text-yellow-900">
              <p className="font-semibold">Hindi available si {driver}.</p>
              {suggestion ? (
                <Button variant="outline" full onClick={() => setDriver(suggestion)}>Gamitin si {suggestion}</Button>
              ) : (
                <p>Wala nang ibang driver sa listahan. Piliin ang &quot;Ibang driver (pamalit)&quot;.</p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {drivers.length > 0 ? (
              <label className="block">
                <span className="mb-1 block font-semibold text-gray-800">Driver</span>
                <select
                  value={other ? OTHER_DRIVER : driver}
                  onChange={(e) => {
                    if (e.target.value === OTHER_DRIVER) {
                      setOther(true);
                      setDriver("");
                    } else {
                      setOther(false);
                      setDriver(e.target.value);
                    }
                  }}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-3"
                >
                  <option value="">-- Pumili ng driver --</option>
                  {drivers.map((d) => (
                    <option key={d} value={d} disabled={off.has(d) && d !== req.driver}>
                      {d}{off.has(d) ? " — hindi available" : ""}
                    </option>
                  ))}
                  <option value={OTHER_DRIVER}>✎ Ibang driver (pamalit)</option>
                </select>
                {other && <input value={driver} onChange={(e) => setDriver(e.target.value)} maxLength={80} placeholder="Pangalan at numero ng pamalit na driver" className="mt-2 w-full rounded-xl border-2 border-gray-200 px-3 py-3" />}
              </label>
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

      {req.status === "pending" && (
        <div className="space-y-3">
          <ApprovalTracker r={req} steps={steps} />
          <ApprovalPanel
            r={req}
            steps={steps}
            fastBy={approvals[cfgKey].fast ? approvals[cfgKey].fastBy ?? "Kapitan" : undefined}
            onAdvance={async (a, n) => {
              // The driver must be chosen before the request moves on.
              if (!driver.trim()) {
                toast("Piliin muna ang Driver bago i-endorso.", "error");
                return;
              }
              if (driverUnavailable) {
                toast(`Hindi available si ${driver}. Pumili ng ibang driver o ng pamalit.`, "error");
                return;
              }
              await step(
                () => advanceRequest("ambulanceRequests", req.id, req, steps, a, n, { driver: driver.trim(), durationHours: Number(hours), adminNote: note.trim().slice(0, 500) }),
                "Naipasa na sa susunod na approver, kasama ang driver.",
              );
            }}
            onReturn={(a, n) => step(() => returnRequest("ambulanceRequests", req.id, req, steps, a, n), "Naibalik sa naunang approver.")}
            onReject={(a, n) =>
              step(async () => {
                await updateDoc(doc(db, "ambulanceRequests", req.id), { status: "rejected", trail: withEntry(req.trail, newEntry("reject", a, n)), adminNote: n.slice(0, 500), updatedAt: serverTimestamp() });
                logActivity("Ambulansya", `Tinanggihan: ${req.patientName} (${n})`, req.id);
              }, "Tinanggihan ang request.")
            }
            onRelease={(a, n) => step(() => release(a, n, false), "Nailabas na. Makakatanggap ang residente ng abiso.")}
            onFast={req.type === "emergency" ? (a, n) => step(() => release(a, n, true), "Agarang inaprubahan.") : undefined}
          />
        </div>
      )}
      {req.status !== "pending" && !isKapitan ? (
        <p className="rounded-xl bg-gold-light p-3 text-sm text-yellow-900">Si <b>Kapitan</b> (o ang Developer) lang ang makakapagpalit ng status ng ambulansya pagkatapos ma-release.</p>
      ) : req.status !== "pending" ? (
      <div className="grid grid-cols-2 gap-2">
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
      ) : null}
    </div>
  );
}

export function AdminAmbulance() {
  const toast = useToast();
  const { settings } = useSettings();
  const { isKapitan } = useAuth();
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
      logActivity("Ambulansya", `Status ng ambulansya: ${AVAILABILITY_LABEL[status]}`);
      toast(`Ambulansya: ${AVAILABILITY_LABEL[status]}`);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  /** Marks a driver as available or not (any admin; changes only offDrivers). */
  const setDriverOff = async (name: string, off: boolean) => {
    const current = new Set(settings.ambulance.offDrivers ?? []);
    if (off) current.add(name);
    else current.delete(name);
    try {
      await setDoc(doc(db, "settings", "main"), { ambulance: { offDrivers: [...current] } }, { merge: true });
      logActivity("Ambulansya", `${name}: ${off ? "hindi available" : "available na ulit"}`);
      toast(`${name}: ${off ? "hindi available" : "available na"}`);
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
              disabled={!isKapitan}
              className={`rounded-xl px-2 py-2 text-sm font-bold ${settings.ambulance.status === s ? AVAIL_BTN[s] : "bg-surface text-gray-600"}`}
              aria-pressed={settings.ambulance.status === s}
            >
              {AVAILABILITY_LABEL[s].replace(" ngayon", "")}
            </button>
          ))}
        </div>
        {settings.ambulance.drivers.length > 0 && (
          <div className="space-y-1.5 border-t border-gray-100 pt-2">
            <p className="font-bold">Mga driver</p>
            <p className="text-xs text-gray-600">Pindutin ang pangalan para i-mark na <b>hindi available</b> (off-duty o may sakit). Hindi siya mapipili sa mga biyahe hanggang ibalik mo.</p>
            <div className="flex flex-wrap gap-2">
              {settings.ambulance.drivers.map((d) => {
                const isOff = (settings.ambulance.offDrivers ?? []).includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDriverOff(d, !isOff)}
                    aria-pressed={!isOff}
                    className={`rounded-full px-3 py-1.5 text-sm font-bold ${isOff ? "bg-red-100 text-red-700 line-through" : "bg-green-100 text-green-800"}`}
                  >
                    {d}{isOff ? " · off" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
        {open && <RequestDetail key={open.id} req={open} all={data} drivers={settings.ambulance.drivers} ambulance={settings.ambulance} onClose={() => setOpenId(null)} />}
      </Modal>

      <Modal open={manual} onClose={() => setManual(false)} title="Manual na booking">
        <p className="mb-3 text-sm text-gray-600">Para sa mga tumawag. Lalabas ito sa “Naghihintay”; i-approve doon para ma-assign ang driver.</p>
        {manual && <AmbulanceForm initialMode="schedule" onDone={() => setManual(false)} />}
      </Modal>
    </div>
  );
}
