"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { Phone, Plus, Search, Trash2, Wrench, UserRound } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { PUROKS, SKILL_TYPES } from "@/lib/constants";
import { friendlyError, sortNewest, telHref } from "@/lib/format";
import type { Skill } from "@/lib/types";
import { Badge, Button, Card, EmptyState, ErrorText, Input, Modal, PageHeader, Select, Spinner } from "@/components/ui";
import { LoginGate } from "@/components/LoginGate";
import { useToast } from "@/components/Toast";

const skillsCollection = collection(db, "skills");

function SkillForm({ onDone }: { onDone: () => void }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", skill: "", purok: "", contact: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile) setForm((f) => ({ name: f.name || profile.fullName, skill: f.skill, purok: f.purok || profile.purok, contact: f.contact || profile.contact }));
  }, [profile]);

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim() || !form.skill || !form.purok || !form.contact.trim()) return setError("Kumpletuhin ang lahat ng field.");
    setLoading(true);
    setError("");
    try {
      await addDoc(skillsCollection, {
        userId: user.uid,
        name: form.name.trim().slice(0, 120),
        skill: form.skill,
        purok: form.purok,
        contact: form.contact.trim(),
        createdAt: serverTimestamp(),
      });
      toast("Nailista na ang skill mo!");
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Pangalan" required value={form.name} onChange={update("name")} />
      <Select label="Skill" required options={SKILL_TYPES} placeholder="-- Pumili --" value={form.skill} onChange={update("skill")} />
      <Select label="Purok" required options={PUROKS} placeholder="-- Pumili --" value={form.purok} onChange={update("purok")} />
      <Input label="Contact Number" type="tel" required value={form.contact} onChange={update("contact")} />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" full loading={loading}>Ilista ang Skill</Button>
    </form>
  );
}

export default function SkillsPage() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { data, loading, error } = useCollection<Skill>(skillsCollection);

  const skills = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortNewest(data).filter((s) => !term || `${s.name} ${s.skill} ${s.purok}`.toLowerCase().includes(term));
  }, [data, search]);

  const remove = async (id: string) => {
    if (!confirm("Tanggalin ang skill na ito sa listahan?")) return;
    try {
      await deleteDoc(doc(db, "skills", id));
      toast("Natanggal na.");
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <div>
      <PageHeader title="Skills Directory" subtitle="Hanapin ang mananahi, electrician, tubero at iba pa" />
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hanapin: tubero, Purok 3, Juan..."
          className="w-full rounded-xl border-2 border-gray-200 bg-white py-3 pl-10 pr-4 outline-none focus:border-brand"
          aria-label="Hanapin ang skill"
        />
      </div>
      <Button full variant="gold" className="mb-4" onClick={() => setOpen(true)}><Plus className="h-5 w-5" /> Magpa-lista ng Skill</Button>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorText>{error}</ErrorText>
      ) : skills.length === 0 ? (
        <EmptyState icon={<Wrench className="h-12 w-12" />} title="Walang nakita" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {skills.map((s) => (
            <Card key={s.id} className="flex items-center gap-3">
              <span className="rounded-full bg-brand-light p-3 text-brand"><UserRound className="h-6 w-6" aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{s.name}</p>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <Badge color="gold">{s.skill}</Badge> {s.purok}
                </div>
              </div>
              <a href={telHref(s.contact)} className="rounded-xl bg-brand p-3 text-white" aria-label={`Tawagan si ${s.name}`}>
                <Phone className="h-5 w-5" />
              </a>
              {user && (isAdmin || s.userId === user.uid) && (
                <button onClick={() => remove(s.id)} className="rounded-xl p-2 text-gray-400" aria-label="Tanggalin">
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Magpa-lista ng Skill">
        <LoginGate message="Mag-login para mailista ang skill mo.">
          <SkillForm onDone={() => setOpen(false)} />
        </LoginGate>
      </Modal>
    </div>
  );
}
