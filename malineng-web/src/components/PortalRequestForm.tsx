"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { CheckCircle2, UserPlus } from "lucide-react";
import { db } from "@/lib/firebase";
import { usePuroks } from "@/lib/useSettings";
import { friendlyError, todayISO } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import { Button, Card, ErrorText, Input, Select, Textarea } from "@/components/ui";

/**
 * For people who have no account yet and do not know how to register: they ask for a visit to the Barangay Hall,
 * where the staff registers them in the Malineng Portal and gives the Barangay ID. No login needed.
 * The document id is the mobile number, so one number can only have one request at a time.
 */
export function PortalRequestForm() {
  const puroks = usePuroks();
  const [form, setForm] = useState({ fullName: "", contact: "", purok: "", date: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [doneDate, setDoneDate] = useState("");
  const update = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const phone = normalizePhone(form.contact);
    if (form.fullName.trim().length < 2 || !form.purok || !form.date) return setError("Kumpletuhin ang pangalan, purok at petsa.");
    if (!phone) return setError("Mali ang contact number. Halimbawa: 09171234567");
    if (form.date < todayISO()) return setError("Pumili ng petsa simula ngayon.");
    const day = new Date(`${form.date}T00:00:00`).getDay();
    if (day === 0 || day === 6) return setError("Sarado ang Barangay Hall tuwing Sabado at Linggo. Pumili ng weekday.");
    setBusy(true);
    try {
      await setDoc(doc(db, "portalRequests", phone), {
        fullName: form.fullName.trim().slice(0, 120),
        contact: phone,
        purok: form.purok,
        date: form.date,
        notes: form.notes.trim().slice(0, 300),
        status: "natanggap",
        createdAt: serverTimestamp(),
      });
      setDoneDate(form.date);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(code === "permission-denied" ? "May naipadala nang request ang numerong ito. Hintayin ang tawag ng Barangay o pumunta sa Barangay Hall." : friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  if (doneDate) {
    return (
      <Card className="space-y-2 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-brand" aria-hidden />
        <p className="font-bold text-brand">Natanggap na ang request mo!</p>
        <p className="text-sm text-gray-700">Pumunta sa Barangay Hall sa <b>{doneDate}</b> dala ang <b>valid ID</b> at ang contact number mo. Ang staff ang magre-register sa iyo sa Malineng Portal at magbibigay ng Barangay ID.</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 border-2 border-gold/50">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white"><UserPlus className="h-5 w-5" aria-hidden /></span>
        <div>
          <p className="font-extrabold">Rehistro sa Malineng Portal</p>
          <p className="text-sm text-gray-600">Wala ka pang account o hindi marunong mag-register? Mag-iskedyul ng pagpunta sa Barangay Hall. Ang staff ang magre-register sa iyo at magbibigay ng Barangay ID. Hindi kailangang mag-login.</p>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <Input label="Buong pangalan" required value={form.fullName} onChange={update("fullName")} maxLength={120} />
        <Input label="Contact number" type="tel" inputMode="tel" required value={form.contact} onChange={update("contact")} hint="Tatawagan ka kung kailangan." />
        <div className="grid grid-cols-2 gap-2">
          <Select label="Purok" options={puroks} placeholder="-- Pumili --" value={form.purok} onChange={update("purok")} required />
          <Input label="Petsa ng pagpunta" type="date" required min={todayISO()} value={form.date} onChange={update("date")} hint="Lunes hanggang Biyernes" />
        </div>
        <Textarea label="Paalala (optional)" value={form.notes} onChange={update("notes")} maxLength={300} />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" full loading={busy}>Ipadala ang request</Button>
      </form>
      <p className="text-center text-xs text-gray-500">Marunong mag-register mag-isa? <Link href="/register" className="font-bold text-brand underline">Mag-register dito</Link></p>
    </Card>
  );
}
