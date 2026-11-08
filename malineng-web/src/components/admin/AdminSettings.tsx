"use client";

import { useRef, useState, type ReactNode } from "react";
import { doc, setDoc } from "firebase/firestore";
import {
  Ambulance,
  ArrowDown,
  ArrowUp,
  Camera,
  ChevronLeft,
  ChevronRight,
  HardHat,
  MapPin,
  Megaphone,
  Plus,
  Siren,
  Thermometer,
  Trash2,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { compressToDataUrl } from "@/lib/upload";
import { db } from "@/lib/firebase";
import { useSettings } from "@/lib/useSettings";
import { ALERT_TYPES } from "@/lib/constants";
import { friendlyError, todayISO } from "@/lib/format";
import { logActivity } from "@/lib/activity";
import type { Settings } from "@/lib/types";
import { Button, Card, Input, Select, Spinner, Textarea } from "@/components/ui";
import { LogoButton, LogoMark } from "@/components/BarangayLogo";
import { useToast } from "@/components/Toast";

type SectionKey = "officials" | "announcements" | "alert" | "emergency" | "ambulance" | "puroks";

/**
 * Saves ONLY the given fields (merge), so one section never overwrites another,
 * nor values changed live elsewhere (logo, ambulance status).
 */
async function saveSettings(patch: Partial<Settings>, what: string) {
  await setDoc(doc(db, "settings", "main"), patch, { merge: true });
  logActivity("Settings", `Nag-update ng Settings: ${what}`);
}

/* ---------- Shared layout for one section ---------- */
function SectionPage({ title, icon: Icon, onBack, onSave, saving, children }: { title: string; icon: LucideIcon; onBack: () => void; onSave: () => void; saving: boolean; children: ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-card active:bg-gray-100" aria-label="Bumalik sa Settings">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="flex items-center gap-1.5 text-base font-bold"><Icon className="h-4 w-4 text-brand" /> {title}</p>
      </div>
      <div className="space-y-3">{children}</div>
      <div className="sticky bottom-20 z-10 mt-4 rounded-2xl bg-white/95 p-2 shadow-float backdrop-blur">
        <Button full variant="gold" loading={saving} onClick={onSave}>I-save ang {title}</Button>
        <p className="mt-1 text-center text-[0.7rem] text-gray-500">Ang section na ito lang ang mase-save</p>
      </div>
    </div>
  );
}

function useSaver(onDone: () => void) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const run = async (fn: () => Promise<void>, okMsg: string) => {
    setSaving(true);
    try {
      await fn();
      toast(okMsg);
      onDone();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setSaving(false);
    }
  };
  return { saving, run, toast };
}

function moveItem<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function OrderButtons({ onUp, onDown, onDelete, first, last }: { onUp: () => void; onDown: () => void; onDelete: () => void; first: boolean; last: boolean }) {
  return (
    <div className="flex shrink-0 items-center">
      <button type="button" onClick={onUp} disabled={first} className="rounded-full p-1.5 text-gray-500 disabled:opacity-25" aria-label="Itaas"><ArrowUp className="h-4 w-4" /></button>
      <button type="button" onClick={onDown} disabled={last} className="rounded-full p-1.5 text-gray-500 disabled:opacity-25" aria-label="Ibaba"><ArrowDown className="h-4 w-4" /></button>
      <button type="button" onClick={onDelete} className="rounded-full p-1.5 text-red-600" aria-label="Tanggalin"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

/* ---------- Mga Opisyal ---------- */
function OfficialPhoto({ photo, name, onChange, onError }: { photo?: string; name: string; onChange: (url: string) => void; onError: (msg: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = async (file?: File) => {
    if (!file) return;
    try {
      onChange(await compressToDataUrl(file, 160, 0.72, 40_000, true));
    } catch (err) {
      onError(friendlyError(err));
    }
  };
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <button type="button" onClick={() => inputRef.current?.click()} className="relative h-14 w-14 overflow-hidden rounded-full bg-brand-light text-brand" aria-label={`Litrato ni ${name || "opisyal"}`}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <UserRound className="mx-auto h-6 w-6" />
        )}
        <span className="absolute bottom-0 right-0 rounded-full bg-brand p-1 text-white"><Camera className="h-3 w-3" /></span>
      </button>
      {photo && <button type="button" onClick={() => onChange("")} className="text-[0.65rem] font-semibold text-red-600">Alisin</button>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

function OfficialsSection({ settings, onBack }: { settings: Settings; onBack: () => void }) {
  const [list, setList] = useState(settings.officials);
  const { saving, run, toast } = useSaver(onBack);
  const save = () =>
    run(
      () => saveSettings({ officials: list.filter((o) => o.name.trim()).map((o) => ({ name: o.name.trim(), position: o.position.trim(), photoURL: o.photoURL ?? "" })) }, "Mga Opisyal"),
      "Na-save ang Mga Opisyal.",
    );
  return (
    <SectionPage title="Mga Opisyal" icon={Users} onBack={onBack} onSave={save} saving={saving}>
      <p className="text-sm text-gray-500">Pindutin ang bilog para lagyan ng litrato. Ang may posisyong <b>“Punong Barangay”</b> ang lalabas sa itaas ng Home at sa pirma ng Clearance.</p>
      {list.map((o, i) => (
        <Card key={i} className="flex items-center gap-3 p-3">
          <OfficialPhoto photo={o.photoURL} name={o.name} onChange={(photoURL) => setList(list.map((x, j) => (j === i ? { ...x, photoURL } : x)))} onError={(m) => toast(m, "error")} />
          <div className="min-w-0 flex-1 space-y-2">
            <Input label="Pangalan" value={o.name} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <Input label="Posisyon" value={o.position} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, position: e.target.value } : x)))} />
          </div>
          <div className="self-start">
            <OrderButtons first={i === 0} last={i === list.length - 1} onUp={() => setList(moveItem(list, i, -1))} onDown={() => setList(moveItem(list, i, 1))} onDelete={() => setList(list.filter((_, j) => j !== i))} />
          </div>
        </Card>
      ))}
      <Button variant="outline" full onClick={() => setList([...list, { position: list.length ? "Kagawad" : "Punong Barangay", name: "" }])}>
        <Plus className="h-4 w-4" /> Magdagdag ng opisyal
      </Button>
    </SectionPage>
  );
}

/* ---------- Mga Anunsyo ---------- */
function AnnouncementsSection({ settings, onBack }: { settings: Settings; onBack: () => void }) {
  const [list, setList] = useState(settings.announcements);
  const { saving, run } = useSaver(onBack);
  const save = () => run(() => saveSettings({ announcements: list.filter((a) => a.title.trim()) }, "Mga Anunsyo"), "Na-save ang Mga Anunsyo.");
  return (
    <SectionPage title="Mga Anunsyo" icon={Megaphone} onBack={onBack} onSave={save} saving={saving}>
      <Button variant="outline" full onClick={() => setList([{ title: "", body: "", date: todayISO() }, ...list])}>
        <Plus className="h-4 w-4" /> Bagong anunsyo
      </Button>
      {list.length === 0 && <Card className="text-center text-sm text-gray-500">Walang anunsyo.</Card>}
      {list.map((a, i) => (
        <Card key={i} className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Anunsyo #{i + 1}</p>
            <OrderButtons first={i === 0} last={i === list.length - 1} onUp={() => setList(moveItem(list, i, -1))} onDown={() => setList(moveItem(list, i, 1))} onDelete={() => setList(list.filter((_, j) => j !== i))} />
          </div>
          <Input label="Pamagat" value={a.title} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
          <Input label="Petsa" type="date" value={a.date} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
          <Textarea label="Detalye" value={a.body} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
        </Card>
      ))}
    </SectionPage>
  );
}

/* ---------- Alert Banner at Heat Index ---------- */
function AlertSection({ settings, onBack }: { settings: Settings; onBack: () => void }) {
  const [alertType, setAlertType] = useState(settings.alertType);
  const [alertBanner, setAlertBanner] = useState(settings.alertBanner);
  const [showHeatIndex, setShowHeatIndex] = useState(settings.showHeatIndex);
  const { saving, run } = useSaver(onBack);
  const save = () => run(() => saveSettings({ alertType, alertBanner: alertBanner.trim(), showHeatIndex }, "Alert Banner at Heat Index"), "Na-save ang Alert Banner.");
  return (
    <SectionPage title="Alert Banner at Heat Index" icon={Thermometer} onBack={onBack} onSave={save} saving={saving}>
      <Card>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm"><b>🌡️ Heat Index banner</b><br /><span className="text-gray-600">Live na init sa Cuyapo, para sa El Niño.</span></span>
          <input type="checkbox" checked={showHeatIndex} onChange={(e) => setShowHeatIndex(e.target.checked)} className="h-6 w-6 shrink-0 accent-[#0B5C3F]" aria-label="Ipakita ang Heat Index banner" />
        </label>
      </Card>
      <Card className="space-y-3">
        <p className="text-sm font-bold">📣 Alert (baha, brownout, bagyo)</p>
        <Select label="Uri ng alert" options={ALERT_TYPES} value={alertType} onChange={(e) => setAlertType(e.target.value as Settings["alertType"])} />
        <Textarea label="Mensahe" hint="Iwanang blangko kung walang alert." value={alertBanner} onChange={(e) => setAlertBanner(e.target.value)} placeholder="Hal. May baha sa Purok 3. Iwasan muna ang daan." />
      </Card>
    </SectionPage>
  );
}

/* ---------- Emergency at Hotlines ---------- */
function EmergencySection({ settings, onBack }: { settings: Settings; onBack: () => void }) {
  const [nums, setNums] = useState(settings.emergencyNumbers);
  const [hotlines, setHotlines] = useState(settings.hotlines);
  const { saving, run } = useSaver(onBack);
  const save = () =>
    run(
      () =>
        saveSettings(
          {
            emergencyNumbers: { tanod: nums.tanod.trim(), healthCenter: nums.healthCenter.trim(), bfp: nums.bfp.trim() },
            hotlines: hotlines
              .map((h) => ({ name: h.name.trim().slice(0, 80), numbers: h.numbers.map((n) => n.trim()).filter(Boolean).slice(0, 5) }))
              .filter((h) => h.name && h.numbers.length),
          },
          "Emergency at Hotlines",
        ),
      "Na-save ang Emergency at Hotlines.",
    );
  return (
    <SectionPage title="Emergency at Hotlines" icon={Siren} onBack={onBack} onSave={save} saving={saving}>
      <Card className="space-y-3">
        <p className="text-sm font-bold">Numero ng Barangay</p>
        <Input label="Tanod" type="tel" value={nums.tanod} onChange={(e) => setNums({ ...nums, tanod: e.target.value })} />
        <Input label="Health Center" type="tel" value={nums.healthCenter} onChange={(e) => setNums({ ...nums, healthCenter: e.target.value })} />
        <Input label="BFP (Bumbero)" type="tel" value={nums.bfp} onChange={(e) => setNums({ ...nums, bfp: e.target.value })} />
      </Card>
      <p className="px-1 text-sm font-bold">Cuyapo Hotlines</p>
      {hotlines.map((h, i) => (
        <Card key={i} className="space-y-2">
          <div className="flex items-end gap-2">
            <div className="flex-1"><Input label="Pangalan" value={h.name} maxLength={80} onChange={(e) => setHotlines(hotlines.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></div>
            <OrderButtons first={i === 0} last={i === hotlines.length - 1} onUp={() => setHotlines(moveItem(hotlines, i, -1))} onDown={() => setHotlines(moveItem(hotlines, i, 1))} onDelete={() => setHotlines(hotlines.filter((_, j) => j !== i))} />
          </div>
          <Input label="Numero" type="tel" hint="Paghiwalayin ng kuwit kung higit sa isa." value={h.numbers.join(", ")} onChange={(e) => setHotlines(hotlines.map((x, j) => (j === i ? { ...x, numbers: e.target.value.split(",").map((n) => n.trimStart()) } : x)))} />
        </Card>
      ))}
      <Button variant="outline" full onClick={() => setHotlines([...hotlines, { name: "", numbers: [""] }])}><Plus className="h-4 w-4" /> Magdagdag ng hotline</Button>
    </SectionPage>
  );
}

/* ---------- Ambulansya ---------- */
function AmbulanceSection({ settings, onBack }: { settings: Settings; onBack: () => void }) {
  const [phone, setPhone] = useState(settings.ambulance.phone);
  const [drivers, setDrivers] = useState(settings.ambulance.drivers.join(", "));
  const [fee, setFee] = useState(settings.ambulance.fee);
  const { saving, run } = useSaver(onBack);
  // Merge keeps ambulance.status (changed live in the Ambulansya section).
  const save = () =>
    run(
      () =>
        saveSettings(
          { ambulance: { phone: phone.trim(), drivers: drivers.split(",").map((d) => d.trim()).filter(Boolean).slice(0, 20), fee: fee.trim().slice(0, 80) } as Settings["ambulance"] },
          "Ambulansya",
        ),
      "Na-save ang Ambulansya.",
    );
  return (
    <SectionPage title="Ambulansya" icon={Ambulance} onBack={onBack} onSave={save} saving={saving}>
      <Card className="space-y-3">
        <Input label="Numero ng ambulansya / driver on duty" type="tel" placeholder="09171234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="Mga driver" hint="Paghiwalayin ng kuwit. Hal. Mang Ben, Mang Tonyo" value={drivers} onChange={(e) => setDrivers(e.target.value)} />
        <Input label="Bayad o donasyon" hint="Iwanang blangko para “Libre” ang lumabas." placeholder="Hal. ₱200 para sa gas" value={fee} onChange={(e) => setFee(e.target.value)} />
      </Card>
    </SectionPage>
  );
}

/* ---------- Mga Purok ---------- */
function PuroksSection({ settings, onBack }: { settings: Settings; onBack: () => void }) {
  const [list, setList] = useState(settings.puroks);
  const { saving, run, toast } = useSaver(onBack);
  const save = () => {
    const seen = new Set<string>();
    const clean = list
      .map((p) => p.trim().replace(/\s+/g, " ").slice(0, 40))
      .filter((p) => {
        const k = p.toLowerCase();
        if (!p || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    if (!clean.length) return toast("Kailangan ng kahit isang Purok.", "error");
    return run(() => saveSettings({ puroks: clean }, "Mga Purok"), "Na-save ang Mga Purok.");
  };
  return (
    <SectionPage title="Mga Purok" icon={MapPin} onBack={onBack} onSave={save} saving={saving}>
      <p className="text-sm text-gray-500">Lalabas ito sa lahat ng dropdown at sa Purok Points. Kapag pinalitan ang pangalan, hindi kusang nagbabago ang mga lumang record.</p>
      <Card className="space-y-2">
        {list.map((p, i) => (
          <div key={i} className="flex items-end gap-1">
            <div className="flex-1"><Input label={`Purok #${i + 1}`} value={p} maxLength={40} onChange={(e) => setList(list.map((x, j) => (j === i ? e.target.value : x)))} /></div>
            <OrderButtons first={i === 0} last={i === list.length - 1} onUp={() => setList(moveItem(list, i, -1))} onDown={() => setList(moveItem(list, i, 1))} onDelete={() => setList(list.filter((_, j) => j !== i))} />
          </div>
        ))}
      </Card>
      <Button variant="outline" full onClick={() => setList([...list, `Purok ${list.length + 1}`])}><Plus className="h-4 w-4" /> Magdagdag ng purok</Button>
    </SectionPage>
  );
}

/* ---------- Settings home (category list) ---------- */
type Tint = "gold" | "green" | "blue" | "orange" | "red" | "purple";
const TINT: Record<Tint, string> = {
  gold: "bg-gold-light text-yellow-700",
  green: "bg-brand-light text-brand",
  blue: "bg-blue-50 text-blue-600",
  orange: "bg-orange-50 text-orange-600",
  red: "bg-red-50 text-red-600",
  purple: "bg-purple-50 text-purple-600",
};

const ROW_CLASS = "flex w-full items-center gap-3 border-b border-gray-100 px-3 py-3 text-left last:border-0 active:bg-gray-50";

function RowBody({ lead, title, sub, right }: { lead: ReactNode; title: string; sub: string; right?: ReactNode }) {
  return (
    <>
      {lead}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-gray-900">{title}</span>
        <span className="block truncate text-xs text-gray-500">{sub}</span>
      </span>
      {right}
      <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" />
    </>
  );
}

function IconLead({ icon: Icon, tint }: { icon: LucideIcon; tint: Tint }) {
  return <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TINT[tint]}`}><Icon className="h-[1.1rem] w-[1.1rem]" /></span>;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 px-1 text-[0.68rem] font-bold uppercase tracking-wider text-gray-500">{title}</p>
      <div className="overflow-hidden rounded-2xl bg-white shadow-card">{children}</div>
    </div>
  );
}

export function AdminSettings() {
  const { settings, loading } = useSettings();
  const [section, setSection] = useState<SectionKey | null>(null);

  if (loading) return <Spinner />;

  const open = (s: SectionKey) => {
    setSection(s);
    window.scrollTo({ top: 0 });
  };
  const back = () => {
    setSection(null);
    window.scrollTo({ top: 0 });
  };

  // Each section mounts fresh from the live settings every time it is opened.
  if (section === "officials") return <OfficialsSection settings={settings} onBack={back} />;
  if (section === "announcements") return <AnnouncementsSection settings={settings} onBack={back} />;
  if (section === "alert") return <AlertSection settings={settings} onBack={back} />;
  if (section === "emergency") return <EmergencySection settings={settings} onBack={back} />;
  if (section === "ambulance") return <AmbulanceSection settings={settings} onBack={back} />;
  if (section === "puroks") return <PuroksSection settings={settings} onBack={back} />;

  const punong = settings.officials.find((o) => /punong/i.test(o.position));
  const onOff = (on: boolean) => (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-black ${on ? "bg-brand-light text-brand" : "bg-gray-100 text-gray-500"}`}>{on ? "ON" : "OFF"}</span>
  );

  return (
    <div className="space-y-4">
      <Group title="Itsura ng website">
        <LogoButton className={ROW_CLASS}>
          <RowBody lead={<LogoMark size="h-9 w-9" />} title="Logo ng Barangay" sub="Pindutin para palitan" />
        </LogoButton>
        <button onClick={() => open("officials")} className={ROW_CLASS}>
          <RowBody
            lead={<IconLead icon={Users} tint="green" />}
            title="Mga Opisyal"
            sub={punong ? `${punong.name} (Punong Barangay)${settings.officials.length > 1 ? ` + ${settings.officials.length - 1} pa` : ""}` : `${settings.officials.length} opisyal`}
          />
        </button>
        <button onClick={() => open("announcements")} className={ROW_CLASS}>
          <RowBody lead={<IconLead icon={Megaphone} tint="blue" />} title="Mga Anunsyo" sub={settings.announcements.length ? `${settings.announcements.length} anunsyo` : "Walang anunsyo"} />
        </button>
      </Group>

      <Group title="Kaligtasan">
        <button onClick={() => open("alert")} className={ROW_CLASS}>
          <RowBody lead={<IconLead icon={Thermometer} tint="orange" />} title="Alert Banner at Heat Index" sub={settings.alertBanner ? `Alert: ${settings.alertBanner}` : "Walang alert · Heat index"} right={onOff(settings.showHeatIndex)} />
        </button>
        <button onClick={() => open("emergency")} className={ROW_CLASS}>
          <RowBody lead={<IconLead icon={Siren} tint="red" />} title="Emergency at Hotlines" sub={`Tanod, Health Center, BFP + ${settings.hotlines.length} hotline`} />
        </button>
        <button onClick={() => open("ambulance")} className={ROW_CLASS}>
          <RowBody lead={<IconLead icon={Ambulance} tint="red" />} title="Ambulansya" sub={`${settings.ambulance.phone || "Walang numero"} · ${settings.ambulance.drivers.length} driver · ${settings.ambulance.fee || "Libre"}`} />
        </button>
      </Group>

      <Group title="Barangay">
        <button onClick={() => open("puroks")} className={ROW_CLASS}>
          <RowBody lead={<IconLead icon={MapPin} tint="purple" />} title="Mga Purok" sub={`${settings.puroks.length} purok: ${settings.puroks.slice(0, 3).join(", ")}${settings.puroks.length > 3 ? "…" : ""}`} />
        </button>
        <a href="#proyekto" className={ROW_CLASS}>
          <RowBody lead={<IconLead icon={HardHat} tint="gold" />} title="Mga Proyekto" sub="Nasa sariling menu: 🏗️ Proyekto" />
        </a>
      </Group>

      <p className="text-center text-xs text-gray-400">Bawat section ay may sariling Save button.</p>
    </div>
  );
}
