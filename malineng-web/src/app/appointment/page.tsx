"use client";

import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { addDoc, collection, deleteDoc, doc, query, serverTimestamp, where } from "firebase/firestore";
import { CalendarCheck, CheckCircle2, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { APPOINTMENT_SERVICES } from "@/lib/constants";
import { formatDate, friendlyError, sortNewest, todayISO } from "@/lib/format";
import type { Appointment } from "@/lib/types";
import { Button, Card, EmptyState, ErrorText, Input, PageHeader, SectionTitle, Select, Spinner, Textarea } from "@/components/ui";
import { LoginGate } from "@/components/LoginGate";
import { useToast } from "@/components/Toast";
import { StatusTracker } from "@/components/StatusTracker";

function BookForm() {
  const { user, profile } = useAuth();
  const params = useSearchParams();
  const toast = useToast();
  const presetService = params.get("service") ?? "";
  const [form, setForm] = useState({
    fullName: "",
    service: (APPOINTMENT_SERVICES as readonly string[]).includes(presetService) ? presetService : "",
    date: "",
    contact: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastRef, setLastRef] = useState<string | null>(null);

  useEffect(() => {
    if (profile) setForm((f) => ({ ...f, fullName: f.fullName || profile.fullName, contact: f.contact || profile.contact }));
  }, [profile]);

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.fullName.trim() || !form.service || !form.date || !form.contact.trim()) return setError("Kumpletuhin ang lahat ng field.");
    if (form.date < todayISO()) return setError("Pumili ng petsa simula ngayon.");
    const day = new Date(`${form.date}T00:00:00`).getDay();
    if (day === 0 || day === 6) return setError("Sarado ang Barangay Hall tuwing Sabado at Linggo. Pumili ng weekday.");

    setLoading(true);
    setError("");
    try {
      const ref = await addDoc(collection(db, "appointments"), {
        userId: user.uid,
        fullName: form.fullName.trim().slice(0, 120),
        service: form.service,
        date: form.date,
        contact: form.contact.trim(),
        notes: form.notes.trim().slice(0, 1000),
        status: "natanggap",
        createdAt: serverTimestamp(),
      });
      setLastRef(ref.id.slice(0, 8).toUpperCase());
      setForm((f) => ({ ...f, date: "", notes: "" }));
      toast("Na-book na ang appointment mo!");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      {lastRef && (
        <div className="mb-4 rounded-xl bg-brand-light p-4 text-center">
          <CheckCircle2 className="mx-auto mb-1 h-10 w-10 text-brand" />
          <p className="font-bold text-brand">Natanggap na ang request mo!</p>
          <p className="text-gray-700">Reference No: <b>{lastRef}</b></p>
          <p className="text-sm text-gray-600">I-track ang status sa ibaba. Magdala ng valid ID.</p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Buong Pangalan" required value={form.fullName} onChange={update("fullName")} />
        <Select label="Serbisyo" required options={APPOINTMENT_SERVICES} placeholder="-- Pumili ng serbisyo --" value={form.service} onChange={update("service")} />
        <Input label="Petsa ng Pagkuha" type="date" required min={todayISO()} value={form.date} onChange={update("date")} hint="Lunes hanggang Biyernes lang" />
        <Input label="Contact Number" type="tel" required value={form.contact} onChange={update("contact")} />
        <Textarea label={form.service === "Blotter" ? "Ano ang irereport? (Detalye)" : "Purpose / Paalala (optional)"} value={form.notes} onChange={update("notes")} maxLength={1000} />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" full loading={loading}><CalendarCheck className="h-5 w-5" /> I-book ang Appointment</Button>
      </form>
    </Card>
  );
}

function MyAppointments() {
  const { user } = useAuth();
  const toast = useToast();
  const q = useMemo(() => (user ? query(collection(db, "appointments"), where("userId", "==", user.uid)) : null), [user]);
  const { data, loading } = useCollection<Appointment>(q);
  const items = useMemo(() => sortNewest(data), [data]);

  const cancel = async (id: string) => {
    if (!confirm("I-cancel ang appointment na ito?")) return;
    try {
      await deleteDoc(doc(db, "appointments", id));
      toast("Na-cancel na.");
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  if (!user) return null;
  return (
    <>
      <SectionTitle>Tracking: Mga Appointment Ko</SectionTitle>
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState icon={<CalendarCheck className="h-12 w-12" />} title="Wala ka pang appointment" />
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id} className={a.status === "ready" ? "ring-2 ring-gold" : ""}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">{a.service}</p>
                  <p className="text-gray-600">{formatDate(a.date)}</p>
                  <p className="text-sm text-gray-400">Ref: {a.id.slice(0, 8).toUpperCase()}</p>
                </div>
                {a.status === "natanggap" && (
                  <button onClick={() => cancel(a.id)} className="rounded-full p-2 text-gray-400" aria-label="I-cancel">
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>
              <StatusTracker status={a.status} />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export default function AppointmentPage() {
  return (
    <div>
      <PageHeader title="Appointment" subtitle="Mag-book online, kunin sa Barangay Hall. Wala nang mahabang pila." />
      <LoginGate message="Mag-login para makapag-book ng appointment.">
        <Suspense fallback={<Spinner />}>
          <BookForm />
        </Suspense>
        <MyAppointments />
      </LoginGate>
    </div>
  );
}
