"use client";

import { useEffect, useRef, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { ArrowDown, ArrowUp, Camera, Plus, Trash2, UserRound } from "lucide-react";
import { compressToDataUrl } from "@/lib/upload";
import { db } from "@/lib/firebase";
import { useSettings } from "@/lib/useSettings";
import { ALERT_TYPES } from "@/lib/constants";
import { friendlyError, todayISO } from "@/lib/format";
import type { Settings } from "@/lib/types";
import { Button, Card, Input, SectionTitle, Select, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { logActivity } from "@/lib/activity";

/** Tap-to-change round photo for an official. Small (≈10KB) so many fit in settings/main. */
function OfficialPhoto({ photo, name, onChange, onError }: { photo?: string; name: string; onChange: (url: string) => void; onError: (msg: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = async (file?: File) => {
    if (!file) return;
    try {
      onChange(await compressToDataUrl(file, 160, 0.72, 40_000));
    } catch (err) {
      onError(friendlyError(err));
    }
  };
  return (
    <div className="mb-1 flex shrink-0 flex-col items-center gap-0.5">
      <button type="button" onClick={() => inputRef.current?.click()} className="relative h-12 w-12 overflow-hidden rounded-full bg-brand-light text-brand" aria-label={`Litrato ni ${name || "opisyal"}`}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <UserRound className="mx-auto h-6 w-6" />
        )}
        <span className="absolute bottom-0 right-0 rounded-full bg-brand p-0.5 text-white"><Camera className="h-3 w-3" /></span>
      </button>
      {photo && <button type="button" onClick={() => onChange("")} className="text-[0.65rem] font-semibold text-red-600">Alisin</button>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

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

  /** Trim, drop blanks/duplicates, cap length. Keeps the admin's order. */
  const cleanPuroks = (list: string[]): string[] => {
    const seen = new Set<string>();
    return list
      .map((p) => p.trim().replace(/\s+/g, " ").slice(0, 40))
      .filter((p) => {
        const key = p.toLowerCase();
        if (!p || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const movePurok = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= draft.puroks.length) return;
    const next = [...draft.puroks];
    [next[index], next[target]] = [next[target], next[index]];
    set("puroks", next);
  };

  const save = async () => {
    const puroks = cleanPuroks(draft.puroks);
    if (puroks.length === 0) {
      toast("Kailangan ng kahit isang Purok.", "error");
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "main"), {
        ...draft,
        puroks,
        ambulance: {
          phone: draft.ambulance.phone.trim(),
          drivers: draft.ambulance.drivers.map((d) => d.trim()).filter(Boolean).slice(0, 20),
          fee: draft.ambulance.fee.trim().slice(0, 80),
          // Status is changed live in the Ambulansya tab; keep the latest value, not the stale draft.
          status: settings.ambulance.status,
        },
        hotlines: draft.hotlines
          .map((h) => ({ name: h.name.trim().slice(0, 80), numbers: h.numbers.map((n) => n.trim()).filter(Boolean).slice(0, 5) }))
          .filter((h) => h.name && h.numbers.length),
        // Logo is changed live from the top bar; keep the latest value, not the stale draft.
        logoURL: settings.logoURL,
        officials: draft.officials.filter((o) => o.name.trim()).map((o) => ({ name: o.name.trim(), position: o.position.trim(), photoURL: o.photoURL ?? "" })),
        announcements: draft.announcements.filter((a) => a.title.trim()),
        projects: draft.projects
          .filter((p) => p.name.trim())
          .map((p) => ({ name: p.name.trim().slice(0, 80), progress: Math.min(100, Math.max(0, Number(p.progress) || 0)) })),
      });
      logActivity("Settings", "Nag-update ng Settings (anunsyo, opisyal, hotlines, proyekto, purok, ambulansya)");
      toast("Na-save ang settings! Makikita na agad sa website.");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <SectionTitle>Mga Purok</SectionTitle>
      <Card className="space-y-3">
        <p className="text-sm text-gray-500">
          Lalabas ang listahang ito sa lahat ng dropdown (Register, Trabaho, Skills, Magparehistro) at sa Purok Points.
          Paalala: kapag pinalitan ang pangalan ng purok, hindi kusang nagbabago ang lumang records.
        </p>
        {draft.puroks.map((p, i) => (
          <div key={i} className="flex items-end gap-1">
            <div className="flex-1">
              <Input
                label={`Purok #${i + 1}`}
                value={p}
                maxLength={40}
                onChange={(e) => set("puroks", draft.puroks.map((x, j) => (j === i ? e.target.value : x)))}
              />
            </div>
            <button type="button" onClick={() => movePurok(i, -1)} disabled={i === 0} className="mb-2 rounded-full p-2 text-gray-500 disabled:opacity-30" aria-label="Itaas">
              <ArrowUp className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => movePurok(i, 1)} disabled={i === draft.puroks.length - 1} className="mb-2 rounded-full p-2 text-gray-500 disabled:opacity-30" aria-label="Ibaba">
              <ArrowDown className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => set("puroks", draft.puroks.filter((_, j) => j !== i))} className="mb-2 rounded-full p-2 text-red-600" aria-label="Tanggalin">
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        ))}
        <Button variant="outline" full onClick={() => set("puroks", [...draft.puroks, `Purok ${draft.puroks.length + 1}`])}>
          <Plus className="h-5 w-5" /> Magdagdag ng Purok
        </Button>
      </Card>

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

      <SectionTitle>Ambulansya</SectionTitle>
      <Card className="space-y-3">
        <Input label="Numero ng ambulansya / driver on duty" type="tel" placeholder="09171234567" value={draft.ambulance.phone} onChange={(e) => set("ambulance", { ...draft.ambulance, phone: e.target.value })} />
        <Input
          label="Mga driver"
          hint="Paghiwalayin ng kuwit. Hal. Mang Ben, Mang Tonyo"
          value={draft.ambulance.drivers.join(", ")}
          onChange={(e) => set("ambulance", { ...draft.ambulance, drivers: e.target.value.split(",").map((d) => d.trimStart()) })}
        />
        <Input label="Bayad o donasyon" hint="Iwanang blangko para “Libre” ang lumabas." placeholder="Hal. ₱200 para sa gas" value={draft.ambulance.fee} onChange={(e) => set("ambulance", { ...draft.ambulance, fee: e.target.value })} />
      </Card>

      <SectionTitle>Cuyapo Hotlines</SectionTitle>
      <Card className="space-y-4">
        <p className="text-sm text-gray-500">Lalabas sa Home at sa Emergency page. Kung higit sa isa ang numero, paghiwalayin ng kuwit (,).</p>
        {draft.hotlines.map((h, i) => (
          <div key={i} className="space-y-2 rounded-xl bg-surface p-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input label="Pangalan" value={h.name} maxLength={80} placeholder="Hal. Cuyapo MDRRMO" onChange={(e) => set("hotlines", draft.hotlines.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              </div>
              <button type="button" onClick={() => set("hotlines", draft.hotlines.filter((_, j) => j !== i))} className="mb-2 rounded-full p-2 text-red-600" aria-label={`Tanggalin ang ${h.name}`}>
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
            <Input
              label="Numero"
              type="tel"
              placeholder="09171234567, 09981234567"
              value={h.numbers.join(", ")}
              onChange={(e) => set("hotlines", draft.hotlines.map((x, j) => (j === i ? { ...x, numbers: e.target.value.split(",").map((n) => n.trimStart()) } : x)))}
            />
          </div>
        ))}
        <Button variant="outline" full onClick={() => set("hotlines", [...draft.hotlines, { name: "", numbers: [""] }])}>
          <Plus className="h-5 w-5" /> Magdagdag ng Hotline
        </Button>
      </Card>

      <SectionTitle>Mga Opisyal</SectionTitle>
      <Card className="space-y-3">
        <p className="text-sm text-gray-500">Pindutin ang bilog para lagyan ng litrato. Gamitin ang posisyong &quot;Punong Barangay&quot; para lumabas siya sa itaas at sa pirma ng Clearance.</p>
        {draft.officials.map((o, i) => (
          <div key={i} className="flex items-end gap-2">
            <OfficialPhoto
              photo={o.photoURL}
              name={o.name}
              onChange={(photoURL) => set("officials", draft.officials.map((x, j) => (j === i ? { ...x, photoURL } : x)))}
              onError={(msg) => toast(msg, "error")}
            />
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
        {draft.projects.length === 0 && <p className="text-gray-500">Walang proyekto. Pindutin ang &quot;Magdagdag ng Proyekto&quot;.</p>}
        {draft.projects.map((p, i) => (
          <div key={i} className="rounded-xl bg-surface p-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input label={`Proyekto #${i + 1}`} value={p.name} maxLength={80} placeholder="Hal. Pagsemento ng Purok 2 Road" onChange={(e) => set("projects", draft.projects.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              </div>
              <span className="mb-3 w-14 text-right font-bold text-brand">{p.progress}%</span>
              <button type="button" onClick={() => set("projects", draft.projects.filter((_, j) => j !== i))} className="mb-2 rounded-full p-2 text-red-600" aria-label={`Tanggalin ang ${p.name}`}>
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
            <input type="range" min={0} max={100} step={5} value={p.progress} onChange={(e) => set("projects", draft.projects.map((x, j) => (j === i ? { ...x, progress: Number(e.target.value) } : x)))} className="mt-2 w-full accent-[#0B5C3F]" aria-label={`Progress ng ${p.name}`} />
          </div>
        ))}
        <Button variant="outline" full onClick={() => set("projects", [...draft.projects, { name: "", progress: 0 }])}>
          <Plus className="h-5 w-5" /> Magdagdag ng Proyekto
        </Button>
      </Card>

      <div className="sticky bottom-20 pt-4">
        <Button full variant="gold" loading={saving} onClick={save} className="shadow-lg">I-save Lahat ng Settings</Button>
      </div>
    </div>
  );
}
