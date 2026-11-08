"use client";

import { useEffect, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useSettings } from "@/lib/useSettings";
import { ALERT_TYPES } from "@/lib/constants";
import { friendlyError, todayISO } from "@/lib/format";
import type { Settings } from "@/lib/types";
import { Button, Card, Input, SectionTitle, Select, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";

export function AdminSettings() {
  const { settings, loading } = useSettings();
  const toast = useToast();
  const [draft, setDraft] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  // Take a local editable copy once settings load.
  useEffect(() => {
    if (!loading && !draft) setDraft(structuredClone(settings));
  }, [loading, settings, draft]);

  if (loading || !draft) return <Spinner />;

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "main"), {
        ...draft,
        officials: draft.officials.filter((o) => o.name.trim()),
        announcements: draft.announcements.filter((a) => a.title.trim()),
        projects: draft.projects.map((p) => ({ name: p.name, progress: Math.min(100, Math.max(0, Number(p.progress) || 0)) })),
      });
      toast("Na-save ang settings! Makikita na agad sa website.");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <SectionTitle>Alert Banner</SectionTitle>
      <Card className="space-y-3">
        <Select label="Uri ng Alert" options={ALERT_TYPES} value={draft.alertType} onChange={(e) => set("alertType", e.target.value as Settings["alertType"])} />
        <Textarea label="Mensahe (iwanang blangko para walang alert)" value={draft.alertBanner} onChange={(e) => set("alertBanner", e.target.value)} placeholder="Hal. May baha sa Purok 3. Iwasan muna ang daan." />
      </Card>

      <SectionTitle>Emergency Numbers</SectionTitle>
      <Card className="space-y-3">
        <Input label="Tanod" type="tel" value={draft.emergencyNumbers.tanod} onChange={(e) => set("emergencyNumbers", { ...draft.emergencyNumbers, tanod: e.target.value })} />
        <Input label="Health Center" type="tel" value={draft.emergencyNumbers.healthCenter} onChange={(e) => set("emergencyNumbers", { ...draft.emergencyNumbers, healthCenter: e.target.value })} />
        <Input label="BFP (Bumbero)" type="tel" value={draft.emergencyNumbers.bfp} onChange={(e) => set("emergencyNumbers", { ...draft.emergencyNumbers, bfp: e.target.value })} />
      </Card>

      <SectionTitle>Mga Opisyal</SectionTitle>
      <Card className="space-y-3">
        <p className="text-sm text-gray-500">Gamitin ang posisyong &quot;Punong Barangay&quot; para lumabas siya sa itaas.</p>
        {draft.officials.map((o, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="grid flex-1 grid-cols-2 gap-2">
              <Input label="Posisyon" value={o.position} onChange={(e) => set("officials", draft.officials.map((x, j) => (j === i ? { ...x, position: e.target.value } : x)))} />
              <Input label="Pangalan" value={o.name} onChange={(e) => set("officials", draft.officials.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            </div>
            <button onClick={() => set("officials", draft.officials.filter((_, j) => j !== i))} className="mb-2 rounded-full p-2 text-red-600" aria-label="Tanggalin"><Trash2 className="h-5 w-5" /></button>
          </div>
        ))}
        <Button variant="outline" full onClick={() => set("officials", [...draft.officials, { position: draft.officials.length ? "Kagawad" : "Punong Barangay", name: "" }])}>
          <Plus className="h-5 w-5" /> Magdagdag ng Opisyal
        </Button>
      </Card>

      <SectionTitle>Mga Anunsyo</SectionTitle>
      <Card className="space-y-4">
        {draft.announcements.map((a, i) => (
          <div key={i} className="space-y-2 rounded-xl bg-surface p-3">
            <Input label="Pamagat" value={a.title} onChange={(e) => set("announcements", draft.announcements.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <Input label="Petsa" type="date" value={a.date} onChange={(e) => set("announcements", draft.announcements.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
            <Textarea label="Detalye" value={a.body} onChange={(e) => set("announcements", draft.announcements.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
            <Button variant="ghost" full onClick={() => set("announcements", draft.announcements.filter((_, j) => j !== i))}><Trash2 className="h-5 w-5" /> Tanggalin</Button>
          </div>
        ))}
        <Button variant="outline" full onClick={() => set("announcements", [{ title: "", body: "", date: todayISO() }, ...draft.announcements])}>
          <Plus className="h-5 w-5" /> Bagong Anunsyo
        </Button>
      </Card>

      <SectionTitle>Transparency: Progress ng Proyekto</SectionTitle>
      <Card className="space-y-4">
        {draft.projects.map((p, i) => (
          <div key={i}>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input label="Proyekto" value={p.name} onChange={(e) => set("projects", draft.projects.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              </div>
              <span className="mb-3 w-14 text-right font-bold text-brand">{p.progress}%</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={p.progress} onChange={(e) => set("projects", draft.projects.map((x, j) => (j === i ? { ...x, progress: Number(e.target.value) } : x)))} className="mt-2 w-full accent-[#0B5C3F]" aria-label={`Progress ng ${p.name}`} />
          </div>
        ))}
      </Card>

      <div className="sticky bottom-20 pt-4">
        <Button full variant="gold" loading={saving} onClick={save} className="shadow-lg">I-save Lahat ng Settings</Button>
      </div>
    </div>
  );
}
