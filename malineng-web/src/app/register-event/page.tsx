"use client";

import { useEffect, useState, type FormEvent } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { REGISTRATION_PURPOSES } from "@/lib/constants";
import { usePuroks } from "@/lib/useSettings";
import { friendlyError } from "@/lib/format";
import { Button, Card, ErrorText, Input, PageHeader, Select } from "@/components/ui";
import { LoginGate } from "@/components/LoginGate";

function RegistrationForm() {
  const { user, profile } = useAuth();
  const puroks = usePuroks();
  const [form, setForm] = useState({ fullName: "", purok: "", contact: "", purpose: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (profile) setForm((f) => ({ ...f, fullName: f.fullName || profile.fullName, purok: f.purok || profile.purok, contact: f.contact || profile.contact }));
  }, [profile]);

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.fullName.trim() || !form.purok || !form.contact.trim() || !form.purpose) return setError("Kumpletuhin ang lahat ng field.");
    setLoading(true);
    setError("");
    try {
      await addDoc(collection(db, "registrations"), {
        userId: user.uid,
        fullName: form.fullName.trim().slice(0, 120),
        purok: form.purok,
        contact: form.contact.trim(),
        purpose: form.purpose,
        createdAt: serverTimestamp(),
      });
      setDone(form.purpose);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Card className="text-center">
        <CheckCircle2 className="mx-auto mb-2 h-20 w-20 text-brand" />
        <p className="text-xl font-extrabold text-brand">Naka-register ka na!</p>
        <p className="mt-1 text-gray-700">Para sa: <b>{done}</b></p>
        <p className="mt-1 text-gray-600">Aabisuhan ka ng Barangay sa contact number mo.</p>
        <Button variant="outline" full className="mt-4" onClick={() => { setDone(null); setForm((f) => ({ ...f, purpose: "" })); }}>
          Mag-register sa iba pa
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Buong Pangalan" required value={form.fullName} onChange={update("fullName")} />
        <Select label="Purok" required options={puroks} placeholder="-- Pumili --" value={form.purok} onChange={update("purok")} />
        <Input label="Contact Number" type="tel" required value={form.contact} onChange={update("contact")} />
        <Select label="Para saan?" required options={REGISTRATION_PURPOSES} placeholder="-- Pumili --" value={form.purpose} onChange={update("purpose")} />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" full loading={loading}><ClipboardList className="h-5 w-5" /> Mag-register</Button>
      </form>
    </Card>
  );
}

export default function RegisterEventPage() {
  return (
    <div>
      <PageHeader title="Magparehistro" subtitle="Para sa Ayuda, Clean-up, Fiesta at iba pang event" />
      <LoginGate message="Mag-login para makapag-register.">
        <RegistrationForm />
      </LoginGate>
    </div>
  );
}
