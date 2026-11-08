"use client";

import { useMemo, useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { formatDate, friendlyError } from "@/lib/format";
import type { BarangayEvent } from "@/lib/types";
import { Button, Card, Input, SectionTitle, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";

const eventsCollection = collection(db, "events");

export function AdminEvents() {
  const { user } = useAuth();
  const toast = useToast();
  const { data } = useCollection<BarangayEvent>(eventsCollection);
  const [form, setForm] = useState({ title: "", date: "", location: "", description: "" });
  const [saving, setSaving] = useState(false);
  const events = useMemo(() => [...data].sort((a, b) => b.date.localeCompare(a.date)), [data]);

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !form.title.trim() || !form.date) return toast("Kailangan ang pamagat at petsa.", "error");
    setSaving(true);
    try {
      await addDoc(eventsCollection, { ...form, title: form.title.trim(), createdBy: user.uid, createdAt: serverTimestamp() });
      setForm({ title: "", date: "", location: "", description: "" });
      toast("Na-add ang event.");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input label="Pamagat" value={form.title} onChange={update("title")} placeholder="Hal. Clean-up Drive" />
          <Input label="Petsa" type="date" value={form.date} onChange={update("date")} />
          <Input label="Lugar" value={form.location} onChange={update("location")} placeholder="Covered Court" />
          <Textarea label="Detalye" value={form.description} onChange={update("description")} />
          <Button type="submit" full loading={saving}>I-add ang Event</Button>
        </form>
      </Card>
      <SectionTitle>Lahat ng Event</SectionTitle>
      <div className="space-y-2">
        {events.map((ev) => (
          <Card key={ev.id} className="flex items-center gap-2">
            <div className="flex-1">
              <p className="font-bold">{ev.title}</p>
              <p className="text-sm text-gray-500">{formatDate(ev.date)} · {ev.location}</p>
            </div>
            <button
              onClick={async () => {
                if (!confirm("Burahin ang event?")) return;
                try { await deleteDoc(doc(db, "events", ev.id)); } catch (err) { toast(friendlyError(err), "error"); }
              }}
              className="rounded-full p-2 text-gray-400"
              aria-label="Burahin"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
