"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { addDoc, collection, query, serverTimestamp, where } from "firebase/firestore";
import { Siren, CalendarClock } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { usePuroks } from "@/lib/useSettings";
import { useCollection } from "@/lib/useCollection";
import { AMBULANCE_REASONS, findBusySlot, formatTime12, nowHHMM } from "@/lib/ambulance";
import { formatDate, friendlyError, todayISO } from "@/lib/format";
import type { AmbulanceSlot } from "@/lib/types";
import { Button, ErrorText, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";

type Mode = "emergency" | "schedule";

/** Resident (or admin manual booking) request form. Always saved as "pending". */
export function AmbulanceForm({ initialMode = "schedule", onDone }: { initialMode?: Mode; onDone?: () => void }) {
  const { user, profile } = useAuth();
  const puroks = usePuroks();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [form, setForm] = useState({
    patientName: "",
    purok: "",
    reason: "",
    date: todayISO(),
    time: "",
    pickup: "",
    destination: "",
    notes: "",
    contact: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile) {
      setForm((f) => ({
        ...f,
        patientName: f.patientName || profile.fullName,
        purok: f.purok || profile.purok,
        contact: f.contact || profile.contact,
        pickup: f.pickup || (profile.purok ? `${profile.purok}, Malineng` : ""),
      }));
    }
  }, [profile]);

  // Public busy windows for the chosen date (no patient info).
  const slotsQ = useMemo(() => (mode === "schedule" && form.date ? query(collection(db, "ambulanceSchedule"), where("date", "==", form.date)) : null), [mode, form.date]);
  const { data: slots } = useCollection<AmbulanceSlot>(slotsQ);
  const busy = useMemo(() => [...slots].sort((a, b) => a.start.localeCompare(b.start)), [slots]);
  const clash = mode === "schedule" && form.time ? findBusySlot(busy, form.date, form.time) : undefined;

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError("");
    if (!form.patientName.trim() || !form.pickup.trim() || !form.contact.trim()) return setError("Kailangan ang pangalan ng pasyente, sunduan at contact number.");
    if (mode === "emergency" && !form.reason.trim()) return setError("Ilagay kung ano ang nangyari.");
    if (mode === "schedule") {
      if (!form.reason) return setError("Pumili ng dahilan.");
      if (!form.date || !form.time) return setError("Pumili ng petsa at oras ng sundo.");
      if (form.date < todayISO() || (form.date === todayISO() && form.time < nowHHMM())) return setError("Lumipas na ang oras na napili.");
      if (clash) return setError(`May biyahe na ang ambulansya mula ${formatTime12(clash.start)} hanggang ${formatTime12(clash.end)}. Pumili ng ibang oras.`);
    }

    setLoading(true);
    try {
      const isEmg = mode === "emergency";
      await addDoc(collection(db, "ambulanceRequests"), {
        userId: user.uid,
        type: mode,
        patientName: form.patientName.trim().slice(0, 120),
        purok: form.purok,
        reason: form.reason.trim().slice(0, 300),
        date: isEmg ? todayISO() : form.date,
        time: isEmg ? nowHHMM() : form.time,
        pickup: form.pickup.trim().slice(0, 200),
        destination: form.destination.trim().slice(0, 200),
        notes: form.notes.trim().slice(0, 1000),
        contact: form.contact.trim().slice(0, 40),
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast(isEmg ? "Naipadala ang emergency request! Tumawag din kung kritikal." : "Naipadala! Aabisuhan ka kapag naaprubahan.");
      setForm((f) => ({ ...f, reason: "", time: "", destination: "", notes: "" }));
      onDone?.();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 rounded-xl bg-surface p-1" role="tablist" aria-label="Uri ng request">
        <button type="button" role="tab" aria-selected={mode === "emergency"} onClick={() => setMode("emergency")} className={`flex items-center justify-center gap-1 rounded-lg py-2 font-bold ${mode === "emergency" ? "bg-red-600 text-white" : "text-gray-600"}`}>
          <Siren className="h-5 w-5" /> Emergency
        </button>
        <button type="button" role="tab" aria-selected={mode === "schedule"} onClick={() => setMode("schedule")} className={`flex items-center justify-center gap-1 rounded-lg py-2 font-bold ${mode === "schedule" ? "bg-brand text-white" : "text-gray-600"}`}>
          <CalendarClock className="h-5 w-5" /> Schedule
        </button>
      </div>

      {mode === "emergency" && (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
          Kung kritikal ang pasyente, <b>tumawag agad</b>. Makikita ng Barangay ang online request, pero mas mabilis ang tawag.
        </p>
      )}

      <Input label="Pangalan ng pasyente" required maxLength={120} value={form.patientName} onChange={update("patientName")} />
      <Select label="Purok" options={puroks} placeholder="-- Pumili --" value={form.purok} onChange={update("purok")} />

      {mode === "emergency" ? (
        <Textarea label="Ano ang nangyari?" required placeholder="Hal. nahimatay, hirap huminga, naaksidente" maxLength={300} value={form.reason} onChange={update("reason")} />
      ) : (
        <>
          <Select label="Dahilan" required options={AMBULANCE_REASONS} placeholder="-- Pumili --" value={form.reason} onChange={update("reason")} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Petsa" type="date" required min={todayISO()} value={form.date} onChange={update("date")} />
            <Input label="Oras ng sundo" type="time" required value={form.time} onChange={update("time")} />
          </div>
          <div className="rounded-xl bg-surface p-3 text-sm">
            <p className="font-bold">Schedule ng ambulansya · {formatDate(form.date)}</p>
            {busy.length === 0 ? (
              <p className="text-brand">✅ Wala pang biyahe. Bakante buong araw.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {busy.map((s) => (
                  <li key={s.id} className="text-gray-700">⛔ May biyahe: <b>{formatTime12(s.start)} – {formatTime12(s.end)}</b></li>
                ))}
              </ul>
            )}
            {clash && <p className="mt-2 font-semibold text-red-700">Tumatama ang napili mong oras sa isang biyahe. Pumili ng iba.</p>}
          </div>
        </>
      )}

      <Input label="Saan susunduin" required maxLength={200} placeholder="Hal. Purok 3, tapat ng kapilya" value={form.pickup} onChange={update("pickup")} />
      <Input label={mode === "emergency" ? "Saang ospital (kung alam)" : "Pupuntahan (ospital o clinic)"} maxLength={200} value={form.destination} onChange={update("destination")} />
      <Textarea label="Paalala (optional)" placeholder="Hal. naka-wheelchair, may 1 kasama" maxLength={1000} value={form.notes} onChange={update("notes")} />
      <Input label="Contact number" type="tel" required value={form.contact} onChange={update("contact")} />

      <ErrorText>{error}</ErrorText>
      <Button type="submit" full loading={loading} variant={mode === "emergency" ? "danger" : "primary"} disabled={!!clash}>
        {mode === "emergency" ? "🚨 Ipadala ang Emergency Request" : "Ipadala ang Request"}
      </Button>
    </form>
  );
}
