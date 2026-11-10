"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { Phone, Plus, Search, Trash2, Wrench, UserRound } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { SKILL_TYPES } from "@/lib/constants";
import { usePuroks } from "@/lib/useSettings";
import { friendlyError, normalizeSkillLabel, sortNewest, telHref } from "@/lib/format";
import type { Skill } from "@/lib/types";
import { Badge, Button, Card, EmptyState, ErrorText, FilterTabs, Input, Modal, PageHeader, Select, Spinner } from "@/components/ui";
import { LoginGate } from "@/components/LoginGate";
import { useToast } from "@/components/Toast";

const skillsCollection = collection(db, "skills");
/** Choosing this in the list lets the resident write their own skill. */
const OTHER = "Iba pa";

function SkillForm({ onDone, knownSkills }: { onDone: () => void; knownSkills: string[] }) {
  const { user, profile } = useAuth();
  const puroks = usePuroks();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", skill: "", custom: "", purok: "", contact: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile) setForm((f) => ({ ...f, name: f.name || profile.fullName, purok: f.purok || profile.purok, contact: f.contact || profile.contact }));
  }, [profile]);

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim() || !form.skill || !form.purok || !form.contact.trim()) return setError("Kumpletuhin ang lahat ng field.");
    // "Iba pa" = the skill the resident wrote, cleaned up so "welder" and "WELDER" count as one.
    const skill = form.skill === OTHER ? normalizeSkillLabel(form.custom) : form.skill;
    if (!skill) return setError("Isulat kung ano ang skill mo.");
    setLoading(true);
    setError("");
    try {
      await addDoc(skillsCollection, {
        userId: user.uid,
        name: form.name.trim().slice(0, 120),
        skill,
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
      {form.skill === OTHER && (
        <>
          <Input
            label="Isulat ang skill mo"
            required
            maxLength={40}
            placeholder="hal. Welder, Barbero, Magtatahi ng kurtina"
            list="skill-suggestions"
            value={form.custom}
            onChange={update("custom")}
            hint="Kung may lumabas na mungkahi, piliin iyon para hindi madoble."
          />
          <datalist id="skill-suggestions">
            {knownSkills.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </>
      )}
      <Select label="Purok" required options={puroks} placeholder="-- Pumili --" value={form.purok} onChange={update("purok")} />
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
  const [filter, setFilter] = useState("Lahat");
  const [open, setOpen] = useState(false);
  const { data, loading, error } = useCollection<Skill>(skillsCollection);

  // Skills that residents added themselves (anything outside the built-in list), most common first.
  const customSkills = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of data) if (!(SKILL_TYPES as readonly string[]).includes(s.skill)) counts.set(s.skill, (counts.get(s.skill) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
  }, [data]);

  // Tabs: only skills that somebody actually has.
  const tabs = useMemo(() => {
    const have = new Set(data.map((s) => s.skill));
    const names = [...SKILL_TYPES.filter((t) => t !== OTHER && have.has(t)), ...customSkills];
    return ["Lahat", ...names].map((value) => ({ value, label: value, count: value === "Lahat" ? undefined : data.filter((s) => s.skill === value).length, tone: "neutral" as const }));
  }, [data, customSkills]);

  const skills = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortNewest(data).filter((s) => (filter === "Lahat" || s.skill === filter) && (!term || `${s.name} ${s.skill} ${s.purok}`.toLowerCase().includes(term)));
  }, [data, search, filter]);

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
      <Button full variant="gold" className="mb-3" onClick={() => setOpen(true)}><Plus className="h-5 w-5" /> Magpa-lista ng Skill</Button>
      {tabs.length > 1 && <FilterTabs label="Uri ng skill" value={tabs.some((t) => t.value === filter) ? filter : "Lahat"} onChange={setFilter} options={tabs} />}

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
          <SkillForm onDone={() => setOpen(false)} knownSkills={customSkills} />
        </LoginGate>
      </Modal>
    </div>
  );
}
