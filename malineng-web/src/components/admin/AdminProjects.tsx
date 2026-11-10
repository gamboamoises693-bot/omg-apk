"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { collection, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { Camera, ExternalLink, ImageOff, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { useSettings } from "@/lib/useSettings";
import { compressToDataUrl } from "@/lib/upload";
import { logActivity } from "@/lib/activity";
import { FUND_SOURCES, INFRA_CATEGORY, PROJECT_CATEGORIES, PROJECT_STATUS_LABEL } from "@/lib/constants";
import { formatPeso, friendlyError, todayISO, tsToMillis } from "@/lib/format";
import type { InfraProject, InfraProjectStatus, ProjectUpdate } from "@/lib/types";
import { Button, Card, EmptyState, ErrorText, Input, Modal, Select, Spinner, Textarea, SelectOther } from "@/components/ui";
import { ProgressBar, ProjectStatusPill, projectSortKey } from "@/components/ProjectBits";
import { useToast } from "@/components/Toast";

const projectsCollection = collection(db, "projects");
const STATUSES = Object.keys(PROJECT_STATUS_LABEL) as InfraProjectStatus[];

type Draft = Omit<InfraProject, "id" | "createdAt" | "updatedAt">;
const EMPTY: Draft = {
  name: "",
  category: INFRA_CATEGORY,
  description: "",
  location: "",
  budget: 0,
  fundSource: FUND_SOURCES[0],
  implementer: "",
  startDate: "",
  targetDate: "",
  completedDate: "",
  status: "planned",
  progress: 0,
  beforeThumb: "",
  afterThumb: "",
  updates: [],
};

interface PhotoState {
  thumb: string;
  full: string;
  changed: boolean;
}

/** Tap-to-pick photo slot. Keeps a small thumbnail (lists) and a larger copy (detail page). */
function PhotoSlot({ label, value, onChange, onError }: { label: string; value: PhotoState; onChange: (v: PhotoState) => void; onError: (m: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = async (file?: File) => {
    if (!file) return;
    try {
      const [thumb, full] = await Promise.all([compressToDataUrl(file, 320, 0.6, 60_000), compressToDataUrl(file, 1000, 0.65, 380_000)]);
      onChange({ thumb, full, changed: true });
    } catch (err) {
      onError(friendlyError(err));
    }
  };
  const shown = value.full || value.thumb;
  return (
    <div>
      <span className="mb-1 block text-[0.85rem] font-semibold text-gray-700">{label}</span>
      <button type="button" onClick={() => inputRef.current?.click()} className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-gray-100 text-gray-400">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt={label} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs font-semibold"><Camera className="h-6 w-6" /> Pumili</span>
        )}
        {shown && <span className="absolute bottom-1 right-1 rounded-full bg-brand p-1.5 text-white"><Camera className="h-3.5 w-3.5" /></span>}
      </button>
      {shown && (
        <button type="button" onClick={() => onChange({ thumb: "", full: "", changed: true })} className="mt-1 text-xs font-semibold text-red-600">Alisin</button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

function ProjectForm({ project, onClose }: { project: InfraProject | null; onClose: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<Draft>(() => (project ? { ...EMPTY, ...project, updates: project.updates ?? [] } : EMPTY));
  const [before, setBefore] = useState<PhotoState>({ thumb: project?.beforeThumb ?? "", full: "", changed: false });
  const [after, setAfter] = useState<PhotoState>({ thumb: project?.afterThumb ?? "", full: "", changed: false });
  const [newUpdate, setNewUpdate] = useState<ProjectUpdate>({ date: todayISO(), note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isInfra = d.category === INFRA_CATEGORY;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const save = async () => {
    if (!d.name.trim()) return setError("Ilagay ang pangalan ng proyekto.");
    setBusy(true);
    setError("");
    try {
      const ref = project ? doc(db, "projects", project.id) : doc(projectsCollection);
      const progress = d.status === "completed" ? 100 : Math.min(100, Math.max(0, Math.round(Number(d.progress) || 0)));
      const updates = newUpdate.note.trim() ? [...d.updates, { date: newUpdate.date || todayISO(), note: newUpdate.note.trim().slice(0, 300) }] : d.updates;
      const batch = writeBatch(db);
      batch.set(ref, {
        ...d,
        name: d.name.trim().slice(0, 120),
        description: d.description.trim().slice(0, 2000),
        location: d.location.trim().slice(0, 120),
        implementer: d.implementer.trim().slice(0, 120),
        budget: Math.max(0, Number(d.budget) || 0),
        progress,
        completedDate: d.status === "completed" ? d.completedDate || todayISO() : d.completedDate,
        beforeThumb: before.thumb,
        afterThumb: after.thumb,
        updates: updates.slice(-30),
        ...(project ? {} : { createdAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
      });
      // Full-size photos: only rewrite the slots that changed (keeps unchanged ones).
      if (before.changed || after.changed) {
        const existing = project ? (await getDoc(doc(db, "projectPhotos", project.id))).data() ?? {} : {};
        batch.set(doc(db, "projectPhotos", ref.id), {
          before: before.changed ? before.full : existing.before ?? "",
          after: after.changed ? after.full : existing.after ?? "",
        });
      }
      await batch.commit();
      logActivity("Settings", `${project ? "Nag-update" : "Nagdagdag"} ng proyekto: “${d.name.trim()}” (${PROJECT_STATUS_LABEL[d.status]}, ${progress}%)`, ref.id);
      toast(project ? "Na-update ang proyekto." : "Nadagdag ang proyekto.");
      onClose();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!project || !confirm(`Burahin ang proyektong “${project.name}”?`)) return;
    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "projects", project.id));
      batch.delete(doc(db, "projectPhotos", project.id));
      await batch.commit();
      logActivity("Settings", `Nagbura ng proyekto: “${project.name}”`, project.id);
      toast("Nabura ang proyekto.");
      onClose();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Input label="Pangalan ng proyekto" placeholder="Hal. Pagsemento ng Purok 2 Road" value={d.name} onChange={(e) => set("name", e.target.value)} maxLength={120} />
      <div className="grid grid-cols-2 gap-2">
        <SelectOther label="Uri" options={PROJECT_CATEGORIES} value={d.category} onChange={(v) => set("category", v)} />
        <Input label="Lokasyon" placeholder="Hal. Purok 2" value={d.location} onChange={(e) => set("location", e.target.value)} />
      </div>
      <Textarea label="Paglalarawan" placeholder="Ano ang ginagawa, gaano kahaba/kalaki, sino ang makikinabang..." value={d.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} />

      <Card className="space-y-3 bg-gray-50 shadow-none">
        <p className="text-sm font-bold">💰 Pondo</p>
        <Input label="Budget (₱)" type="number" inputMode="decimal" min={0} value={d.budget || ""} onChange={(e) => set("budget", Number(e.target.value))} />
        <SelectOther label="Pinagmulan ng pondo" options={FUND_SOURCES} value={d.fundSource} onChange={(v) => set("fundSource", v)} />
        <Input label="Contractor / Nagpatupad" placeholder="Hal. Barangay Council, ABC Construction" value={d.implementer} onChange={(e) => set("implementer", e.target.value)} />
      </Card>

      <Card className="space-y-3 bg-gray-50 shadow-none">
        <p className="text-sm font-bold">📅 Status at petsa</p>
        <Select label="Status" options={STATUSES.map((s) => PROJECT_STATUS_LABEL[s])} value={PROJECT_STATUS_LABEL[d.status]} onChange={(e) => set("status", STATUSES.find((s) => PROJECT_STATUS_LABEL[s] === e.target.value) ?? "planned")} />
        <div>
          <span className="mb-1 flex justify-between text-[0.85rem] font-semibold text-gray-700"><span>Progress</span><span className="text-brand">{d.status === "completed" ? 100 : d.progress}%</span></span>
          <input type="range" min={0} max={100} step={5} value={d.status === "completed" ? 100 : d.progress} disabled={d.status === "completed"} onChange={(e) => set("progress", Number(e.target.value))} className="w-full accent-brand" aria-label="Progress" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input label="Sinimulan" type="date" value={d.startDate} onChange={(e) => set("startDate", e.target.value)} />
          <Input label="Target matapos" type="date" value={d.targetDate} onChange={(e) => set("targetDate", e.target.value)} />
        </div>
        {d.status === "completed" && <Input label="Natapos noong" type="date" value={d.completedDate || todayISO()} onChange={(e) => set("completedDate", e.target.value)} />}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        {isInfra ? (
          <>
            <PhotoSlot label="📷 BEFORE" value={before} onChange={setBefore} onError={setError} />
            <PhotoSlot label="📷 AFTER" value={after} onChange={setAfter} onError={setError} />
          </>
        ) : (
          <div className="col-span-2"><PhotoSlot label="📷 Larawan" value={after} onChange={setAfter} onError={setError} /></div>
        )}
      </div>
      {isInfra && <p className="-mt-2 text-xs text-gray-500">Kunan ang “Before” bago simulan. Kapag tapos na, kunan ang “After” mula sa parehong anggulo, para maganda ang paghahambing.</p>}

      <Card className="space-y-2 bg-gray-50 shadow-none">
        <p className="text-sm font-bold">📝 Mga update ({d.updates.length})</p>
        {[...d.updates].map((u, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <span className="shrink-0 text-xs font-semibold text-gray-500">{u.date}</span>
            <span className="flex-1">{u.note}</span>
            <button onClick={() => set("updates", d.updates.filter((_, j) => j !== i))} className="text-red-600" aria-label="Tanggalin ang update"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <div className="grid grid-cols-[8.5rem_1fr] gap-2">
          <input type="date" value={newUpdate.date} onChange={(e) => setNewUpdate((u) => ({ ...u, date: e.target.value }))} className="rounded-xl border border-gray-200 bg-white px-2 py-2" aria-label="Petsa ng update" />
          <input value={newUpdate.note} onChange={(e) => setNewUpdate((u) => ({ ...u, note: e.target.value }))} placeholder="Hal. Natapos ang pundasyon" className="min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2" aria-label="Bagong update" />
        </div>
        <p className="text-xs text-gray-500">Mase-save ang bagong update kasabay ng pagpindot sa I-save.</p>
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button full loading={busy} onClick={save}>I-save ang proyekto</Button>
      {project && (
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/proyekto/item?id=${project.id}`} target="_blank" className="flex items-center justify-center gap-1 rounded-xl bg-brand-light py-2.5 text-sm font-bold text-brand"><ExternalLink className="h-4 w-4" /> Tingnan</Link>
          <Button variant="ghost" loading={busy} onClick={remove} className="text-red-600"><Trash2 className="h-4 w-4" /> Burahin</Button>
        </div>
      )}
    </div>
  );
}

export function AdminProjects() {
  const toast = useToast();
  const { settings } = useSettings();
  const { data, loading } = useCollection<InfraProject>(projectsCollection);
  const [editing, setEditing] = useState<InfraProject | "new" | null>(null);

  const list = useMemo(() => [...data].sort((a, b) => projectSortKey(a.status) - projectSortKey(b.status) || tsToMillis(b.updatedAt) - tsToMillis(a.updatedAt)), [data]);
  const legacy = settings.projects.filter((p) => p.name.trim());

  /** One-time move of the old simple progress bars (Settings) into detailed projects. */
  const importLegacy = async () => {
    try {
      const batch = writeBatch(db);
      legacy.forEach((p) => {
        batch.set(doc(projectsCollection), {
          ...EMPTY,
          name: p.name,
          progress: p.progress,
          status: p.progress >= 100 ? "completed" : p.progress > 0 ? "ongoing" : "planned",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      batch.set(doc(db, "settings", "main"), { projects: [] }, { merge: true });
      await batch.commit();
      logActivity("Settings", `Inilipat ang ${legacy.length} lumang proyekto sa bagong Proyekto tab`);
      toast("Nailipat! Buksan ang bawat isa para lagyan ng detalye at litrato.");
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      {legacy.length > 0 && data.length === 0 && (
        <Card className="mb-3 space-y-2 bg-gold-light">
          <p className="text-sm font-semibold text-yellow-900">May {legacy.length} lumang proyekto sa Settings ({legacy.map((p) => p.name).join(", ")}).</p>
          <Button variant="gold" full onClick={importLegacy}>Ilipat dito para malagyan ng detalye</Button>
        </Card>
      )}

      <Button full className="mb-3" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Bagong proyekto</Button>

      {list.length === 0 ? (
        <EmptyState title="Wala pang proyekto" />
      ) : (
        <ul className="space-y-2">
          {list.map((p) => (
            <li key={p.id}>
              <button onClick={() => setEditing(p)} className="flex w-full gap-3 rounded-2xl bg-white p-3 text-left shadow-card active:bg-gray-50">
                {p.afterThumb || p.beforeThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.afterThumb || p.beforeThumb} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-300"><ImageOff className="h-5 w-5" /></span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-bold">{p.name}</p>
                    <ProjectStatusPill status={p.status} />
                  </div>
                  <p className="truncate text-xs text-gray-500">{p.category}{p.budget > 0 ? ` · ${formatPeso(p.budget)}` : ""}</p>
                  <div className="mt-1 flex items-center gap-2"><div className="flex-1"><ProgressBar value={p.progress} /></div><span className="text-xs font-bold text-brand">{p.progress}%</span></div>
                  {p.category === INFRA_CATEGORY && (
                    <p className="mt-0.5 text-[0.7rem] text-gray-500">Before {p.beforeThumb ? "✓" : "—"} · After {p.afterThumb ? "✓" : "—"}</p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Bagong proyekto" : "I-edit ang proyekto"}>
        {editing !== null && <ProjectForm key={editing === "new" ? "new" : editing.id} project={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
