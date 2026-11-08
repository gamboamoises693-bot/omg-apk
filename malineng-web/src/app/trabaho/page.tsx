"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { addDoc, collection, query, serverTimestamp, where } from "firebase/firestore";
import { Briefcase, CheckCircle2, MapPin, Phone, Plus, Wallet } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { JOB_CATEGORIES } from "@/lib/constants";
import { usePuroks } from "@/lib/useSettings";
import { friendlyError, sortNewest, telHref, timeAgo } from "@/lib/format";
import type { Job } from "@/lib/types";
import { Badge, Button, Card, EmptyState, ErrorText, Input, Modal, PageHeader, Select, Spinner } from "@/components/ui";
import { LoginGate } from "@/components/LoginGate";
import { useToast } from "@/components/Toast";

function JobForm({ onDone }: { onDone: () => void }) {
  const { user, profile } = useAuth();
  const puroks = usePuroks();
  const toast = useToast();
  const [form, setForm] = useState({ title: "", purok: "", salary: "", contact: "", category: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile) setForm((f) => ({ ...f, purok: f.purok || profile.purok, contact: f.contact || profile.contact }));
  }, [profile]);

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.title.trim() || !form.purok || !form.contact.trim() || !form.category) return setError("Kumpletuhin ang lahat ng field.");
    setLoading(true);
    setError("");
    try {
      await addDoc(collection(db, "jobs"), {
        posterId: user.uid,
        posterName: profile?.fullName ?? user.displayName ?? "Residente",
        title: form.title.trim().slice(0, 120),
        purok: form.purok,
        salary: form.salary.trim().slice(0, 60),
        contact: form.contact.trim(),
        category: form.category,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      toast("Naipadala! Lalabas ito kapag na-approve ng admin.");
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Anong trabaho?" required maxLength={120} placeholder="Hal. Kailangan ng helper sa karinderya" value={form.title} onChange={update("title")} />
      <Select label="Category" required options={JOB_CATEGORIES} placeholder="-- Pumili --" value={form.category} onChange={update("category")} />
      <Select label="Purok" required options={puroks} placeholder="-- Pumili --" value={form.purok} onChange={update("purok")} />
      <Input label="Sahod" placeholder="Hal. ₱500/araw" value={form.salary} onChange={update("salary")} />
      <Input label="Contact Number" type="tel" required value={form.contact} onChange={update("contact")} />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" full loading={loading}>I-post ang Trabaho</Button>
    </form>
  );
}

export default function TrabahoPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [interested, setInterested] = useState<Job | null>(null);
  const [filter, setFilter] = useState("Lahat");
  const q = useMemo(() => query(collection(db, "jobs"), where("status", "==", "approved")), []);
  const { data, loading, error } = useCollection<Job>(q);
  const jobs = useMemo(() => sortNewest(data).filter((j) => filter === "Lahat" || j.category === filter), [data, filter]);

  return (
    <div>
      <PageHeader title="Trabaho at Sideline" subtitle="Trabaho na malapit lang sa bahay" />
      <Button full onClick={() => setFormOpen(true)} className="mb-4"><Plus className="h-5 w-5" /> Mag-post ng Trabaho</Button>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {["Lahat", ...JOB_CATEGORIES].map((c) => (
          <button key={c} onClick={() => setFilter(c)} className={`shrink-0 rounded-full px-4 py-2 font-semibold ${filter === c ? "bg-brand text-white" : "bg-white text-gray-700 ring-1 ring-gray-200"}`}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorText>{error}</ErrorText>
      ) : jobs.length === 0 ? (
        <EmptyState icon={<Briefcase className="h-12 w-12" />} title="Wala pang trabahong naka-post" />
      ) : (
        <div className="space-y-3">
          {jobs.map((j) => (
            <Card key={j.id}>
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="text-lg font-bold leading-tight">{j.title}</p>
                <Badge color="green">{j.category}</Badge>
              </div>
              <p className="flex items-center gap-2 text-gray-600"><MapPin className="h-4 w-4" /> {j.purok}</p>
              {j.salary && <p className="flex items-center gap-2 font-semibold text-brand"><Wallet className="h-4 w-4" /> {j.salary}</p>}
              <p className="text-sm text-gray-500">Ni {j.posterName} · {timeAgo(j.createdAt)}</p>
              <Button variant="gold" full className="mt-3" onClick={() => setInterested(j)}>Interesado Ako</Button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Mag-post ng Trabaho">
        <LoginGate message="Mag-login para makapag-post ng trabaho.">
          <JobForm onDone={() => setFormOpen(false)} />
        </LoginGate>
      </Modal>

      <Modal open={!!interested} onClose={() => setInterested(null)} title="Salamat sa interes!">
        {interested && (
          <div className="text-center">
            <CheckCircle2 className="mx-auto mb-2 h-14 w-14 text-brand" />
            <p className="text-gray-700">Kontakin si <b>{interested.posterName}</b> para sa trabahong:</p>
            <p className="mt-1 text-lg font-bold">{interested.title}</p>
            <p className="my-4 text-2xl font-extrabold text-brand">{interested.contact}</p>
            <a href={telHref(interested.contact)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-white">
              <Phone className="h-5 w-5" /> Tawagan Ngayon
            </a>
            <a href={`sms:${interested.contact.replace(/[^\d+]/g, "")}?body=${encodeURIComponent(`Hello po, interesado po ako sa "${interested.title}" na naka-post sa Barangay Malineng website.`)}`} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-brand py-3 font-bold text-brand">
              I-text
            </a>
          </div>
        )}
      </Modal>
    </div>
  );
}
