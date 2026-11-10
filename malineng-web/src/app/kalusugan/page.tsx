"use client";

import { useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, deleteField, doc, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { Baby, BellRing, HeartPulse, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { usePuroks } from "@/lib/useSettings";
import { logActivity } from "@/lib/activity";
import { friendlyError, todayISO } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import { VACCINES, ageText, childSummary, doseState, dueDate, shortDate, weeksPregnant, type Child, type DoseState, type Pregnancy } from "@/lib/kalusugan";
import type { UserProfile } from "@/lib/types";
import { Badge, Button, Card, EmptyState, ErrorText, FilterTabs, Input, Modal, PageHeader, Select, Spinner } from "@/components/ui";
import { LoginGate } from "@/components/LoginGate";
import { useToast } from "@/components/Toast";

const STATE_STYLE: Record<DoseState, string> = {
  done: "bg-emerald-100 text-emerald-800",
  overdue: "bg-red-100 text-red-800 ring-1 ring-red-300",
  due: "bg-gold-light text-yellow-900 ring-1 ring-gold",
  upcoming: "bg-gray-100 text-gray-500",
};

/* ---------------- Child card (parent view + BHW view) ---------------- */

function ChildCard({ c, canEdit, onEdit }: { c: Child; canEdit: boolean; onEdit?: () => void }) {
  const toast = useToast();
  const s = childSummary(c);

  const toggle = async (code: string, label: string) => {
    if (!canEdit) return;
    const given = !!c.vaccines?.[code];
    if (given && !confirm(`Alisin ang tala na nabigyan ng ${label}?`)) return;
    try {
      await updateDoc(doc(db, "children", c.id), { [`vaccines.${code}`]: given ? deleteField() : todayISO() });
      logActivity("Kalusugan", `${given ? "Inalis" : "Naitala"} ang ${label} ni ${c.name}`, c.id);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <Card className="space-y-2.5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand"><Baby className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">{c.name}</p>
          <p className="text-xs text-gray-500">{ageText(c.birthday)} · {c.sex} · {c.purok || "—"}{canEdit && c.parentName ? ` · ${c.parentName}` : ""}</p>
        </div>
        {s.complete ? <Badge color="green">Kumpleto ✓</Badge> : s.overdue.length ? <Badge color="red">{s.overdue.length} lampas</Badge> : <Badge color="blue">{s.done}/{VACCINES.length}</Badge>}
        {canEdit && onEdit && (
          <button onClick={onEdit} className="p-1 text-brand" aria-label={`Ayusin ang ${c.name}`}><Pencil className="h-4 w-4" /></button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {VACCINES.map((v) => {
          const st = doseState(c, v.code);
          const label = `${v.label}: ${st === "done" ? `nabigyan ${shortDate(c.vaccines[v.code])}` : `takdang ${shortDate(dueDate(c.birthday, v.ageDays))}`}`;
          return (
            <button key={v.code} onClick={() => toggle(v.code, v.label)} disabled={!canEdit} title={label} aria-label={label} className={`rounded-full px-2 py-0.5 text-[0.7rem] font-bold ${STATE_STYLE[st]} ${canEdit ? "" : "cursor-default"}`}>
              {st === "done" ? "✓ " : ""}{v.label}
            </button>
          );
        })}
      </div>
      {s.next && (
        <p className={`rounded-xl p-2.5 text-[0.82rem] ${s.overdue.length ? "bg-red-50 text-red-800" : "bg-brand-light text-brand-deep"}`}>
          {s.overdue.length
            ? `Lampas na sa schedule: ${s.overdue.map((x) => x.v.label).join(", ")}. Dalhin sa Health Center sa lalong madaling panahon.`
            : `Susunod: ${s.next.v.label} sa ${shortDate(s.next.date)}. Dalhin ang baby book sa Health Center.`}
        </p>
      )}
      {canEdit && <p className="text-[0.7rem] text-gray-400">Pindutin ang bakuna para itala na nabigyan ngayong araw.</p>}
    </Card>
  );
}

/* ---------------- BHW forms ---------------- */

function useParents() {
  const usersQ = useMemo(() => collection(db, "users"), []);
  return useCollection<UserProfile & { id: string }>(usersQ).data;
}

function ParentPicker({ users, value, onPick }: { users: (UserProfile & { id: string })[]; value: string; onPick: (u: (UserProfile & { id: string }) | null) => void }) {
  const [q, setQ] = useState("");
  const picked = users.find((u) => u.id === value);
  const matches = q.trim().length >= 2 ? users.filter((u) => u.fullName.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 5) : [];
  if (picked)
    return (
      <p className="flex items-center justify-between rounded-xl bg-emerald-50 p-2.5 text-xs text-emerald-900">
        <span>Naka-link sa account ni <b>{picked.fullName}</b> (makikita niya ito)</span>
        <button onClick={() => onPick(null)} className="font-bold underline">Alisin</button>
      </p>
    );
  return (
    <div className="space-y-1.5">
      <Input label="I-link sa account (optional)" placeholder="Hanapin ang pangalan..." value={q} onChange={(e) => setQ(e.target.value)} />
      {matches.map((u) => (
        <button key={u.id} onClick={() => { onPick(u); setQ(""); }} className="block w-full rounded-lg bg-gray-50 px-3 py-2 text-left text-sm">
          {u.fullName} <span className="text-xs text-gray-500">· {u.purok}</span>
        </button>
      ))}
    </div>
  );
}

function ChildForm({ existing, onDone }: { existing?: Child; onDone: () => void }) {
  const toast = useToast();
  const puroks = usePuroks();
  const users = useParents();
  const [name, setName] = useState(existing?.name ?? "");
  const [birthday, setBirthday] = useState(existing?.birthday ?? "");
  const [sex, setSex] = useState<Child["sex"]>(existing?.sex ?? "Lalaki");
  const [purok, setPurok] = useState(existing?.purok ?? "");
  const [parentId, setParentId] = useState(existing?.parentId ?? "");
  const [parentName, setParentName] = useState(existing?.parentName ?? "");
  const [parentContact, setParentContact] = useState(existing?.parentContact ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    if (!name.trim()) return setError("Ilagay ang pangalan ng bata.");
    if (!birthday) return setError("Ilagay ang birthday.");
    setBusy(true);
    try {
      const data = { name: name.trim().slice(0, 120), birthday, sex, purok, parentId, parentName: parentName.trim().slice(0, 120), parentContact: normalizePhone(parentContact) || parentContact.trim().slice(0, 20), notes: existing?.notes ?? "" };
      if (existing) {
        await updateDoc(doc(db, "children", existing.id), data);
        logActivity("Kalusugan", `Inayos ang record ni ${data.name}`, existing.id);
      } else {
        const ref = await addDoc(collection(db, "children"), { ...data, vaccines: {}, createdAt: serverTimestamp() });
        logActivity("Kalusugan", `Nirehistro ang bata: ${data.name}`, ref.id);
      }
      toast("Na-save.");
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing || !confirm(`Burahin ang record ni ${existing.name}?`)) return;
    try {
      await deleteDoc(doc(db, "children", existing.id));
      logActivity("Kalusugan", `Binura ang record ni ${existing.name}`, existing.id);
      onDone();
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <div className="space-y-3">
      <Input label="Pangalan ng bata" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      <div className="grid grid-cols-2 gap-2">
        <Input label="Birthday" type="date" max={todayISO()} value={birthday} onChange={(e) => setBirthday(e.target.value)} />
        <Select label="Kasarian" options={["Lalaki", "Babae"]} value={sex} onChange={(e) => setSex(e.target.value as Child["sex"])} />
      </div>
      <Select label="Purok" options={puroks} placeholder="Piliin" value={purok} onChange={(e) => setPurok(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <Input label="Magulang" value={parentName} onChange={(e) => setParentName(e.target.value)} maxLength={120} />
        <Input label="Contact" type="tel" inputMode="tel" value={parentContact} onChange={(e) => setParentContact(e.target.value)} />
      </div>
      <ParentPicker
        users={users}
        value={parentId}
        onPick={(u) => {
          setParentId(u?.id ?? "");
          if (u) {
            setParentName(parentName || u.fullName);
            setParentContact(parentContact || u.contact || "");
            setPurok(purok || u.purok || "");
          }
        }}
      />
      <ErrorText>{error}</ErrorText>
      <Button full loading={busy} onClick={save}>I-save</Button>
      {existing && <button onClick={remove} className="flex w-full items-center justify-center gap-1 text-sm font-semibold text-red-700"><Trash2 className="h-4 w-4" /> Burahin</button>}
    </div>
  );
}

function PregnancyForm({ existing, onDone }: { existing?: Pregnancy; onDone: () => void }) {
  const toast = useToast();
  const puroks = usePuroks();
  const users = useParents();
  const [name, setName] = useState(existing?.name ?? "");
  const [userId, setUserId] = useState(existing?.userId ?? "");
  const [purok, setPurok] = useState(existing?.purok ?? "");
  const [contact, setContact] = useState(existing?.contact ?? "");
  const [due, setDue] = useState(existing?.dueDate ?? "");
  const [nextCheckup, setNextCheckup] = useState(existing?.nextCheckup ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (extra: Partial<Pregnancy> = {}) => {
    setError("");
    if (!name.trim()) return setError("Ilagay ang pangalan.");
    setBusy(true);
    try {
      const data = { name: name.trim().slice(0, 120), userId, purok, contact: normalizePhone(contact) || contact.trim().slice(0, 20), dueDate: due, nextCheckup, ...extra };
      if (existing) {
        await updateDoc(doc(db, "pregnancies", existing.id), data);
        logActivity("Kalusugan", `Inayos ang prenatal record ni ${data.name}`, existing.id);
      } else {
        const ref = await addDoc(collection(db, "pregnancies"), { ...data, checkups: [], status: "active", notes: "", createdAt: serverTimestamp() });
        logActivity("Kalusugan", `Nirehistro ang buntis: ${data.name}`, ref.id);
      }
      toast("Na-save.");
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Input label="Pangalan" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      <ParentPicker users={users} value={userId} onPick={(u) => { setUserId(u?.id ?? ""); if (u) { setName(name || u.fullName); setPurok(purok || u.purok || ""); setContact(contact || u.contact || ""); } }} />
      <div className="grid grid-cols-2 gap-2">
        <Select label="Purok" options={puroks} placeholder="Piliin" value={purok} onChange={(e) => setPurok(e.target.value)} />
        <Input label="Contact" type="tel" inputMode="tel" value={contact} onChange={(e) => setContact(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <Input label="Susunod na check-up" type="date" value={nextCheckup} onChange={(e) => setNextCheckup(e.target.value)} />
      </div>
      <ErrorText>{error}</ErrorText>
      <Button full loading={busy} onClick={() => save(existing && nextCheckup && nextCheckup !== existing.nextCheckup && existing.nextCheckup ? { checkups: [...(existing.checkups ?? []), existing.nextCheckup] } : {})}>I-save</Button>
      {existing?.status === "active" && (
        <Button variant="outline" full loading={busy} onClick={() => confirm(`Nanganak na si ${existing.name}?`) && save({ status: "delivered" })}>Nanganak na</Button>
      )}
    </div>
  );
}

/* ---------------- BHW panel ---------------- */

function BhwPanel() {
  const { profile } = useAuth();
  const toast = useToast();
  const children = useCollection<Child>(useMemo(() => collection(db, "children"), []));
  const pregs = useCollection<Pregnancy>(useMemo(() => collection(db, "pregnancies"), []));
  const [tab, setTab] = useState<"linggo" | "bata" | "buntis">("linggo");
  const [search, setSearch] = useState("");
  const [editChild, setEditChild] = useState<Child | null>(null);
  const [addChild, setAddChild] = useState(false);
  const [editPreg, setEditPreg] = useState<Pregnancy | null>(null);
  const [addPreg, setAddPreg] = useState(false);
  const [sending, setSending] = useState(false);

  const t = search.trim().toLowerCase();
  const kids = children.data.filter((c) => !t || `${c.name} ${c.parentName} ${c.purok}`.toLowerCase().includes(t)).sort((a, b) => b.birthday.localeCompare(a.birthday));
  const activePregs = pregs.data.filter((p) => p.status === "active").sort((a, b) => (a.nextCheckup || "9").localeCompare(b.nextCheckup || "9"));

  const dueKids = children.data.filter((c) => { const s = childSummary(c); return s.overdue.length > 0 || s.due.length > 0; });
  const overdueKids = dueKids.filter((c) => childSummary(c).overdue.length > 0);
  const weekAhead = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const checkupsSoon = activePregs.filter((p) => p.nextCheckup && p.nextCheckup <= weekAhead);

  const sendReminder = async () => {
    const puroks = [...new Set(dueKids.map((c) => c.purok).filter(Boolean))];
    if (!confirm(`Magpadala ng paalala sa ${puroks.length ? puroks.join(", ") : "lahat ng purok"}?`)) return;
    setSending(true);
    try {
      await addDoc(collection(db, "announcements"), {
        title: "Paalala: bakuna ng mga bata",
        body: `May ${dueKids.length} batang kailangang bakunahan ngayong linggo. Dalhin ang anak at ang baby book sa Barangay Health Center. Tingnan ang schedule ng anak mo sa Kalusugan page.`,
        category: "Kalusugan",
        puroks,
        createdAt: serverTimestamp(),
        createdByName: profile?.fullName ?? "BHW",
      });
      logActivity("Kalusugan", `Nagpadala ng paalala sa bakuna (${dueKids.length} bata)`);
      toast("Naipadala sa Pabatid.");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setSending(false);
    }
  };

  if (children.loading || pregs.loading) return <Spinner />;

  return (
    <div className="mb-6">
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-white p-2.5 shadow-card"><p className="text-xl font-extrabold text-brand">{dueKids.length}</p><p className="text-[0.68rem] text-gray-600">Bakuna (2 linggo)</p></div>
        <div className="rounded-2xl bg-white p-2.5 shadow-card"><p className="text-xl font-extrabold text-red-700">{overdueKids.length}</p><p className="text-[0.68rem] text-gray-600">Lampas na</p></div>
        <div className="rounded-2xl bg-white p-2.5 shadow-card"><p className="text-xl font-extrabold text-brand">{checkupsSoon.length}</p><p className="text-[0.68rem] text-gray-600">Prenatal (7 araw)</p></div>
      </div>
      <FilterTabs
        label="Kalusugan"
        value={tab}
        onChange={setTab}
        options={[
          { value: "linggo", label: "Ngayon", count: dueKids.length + checkupsSoon.length },
          { value: "bata", label: "Bata", count: children.data.length, tone: "neutral" },
          { value: "buntis", label: "Buntis", count: activePregs.length, tone: "neutral" },
        ]}
      />

      {tab === "linggo" && (
        <div className="space-y-2.5">
          {dueKids.length > 0 && (
            <Button full loading={sending} onClick={sendReminder}><BellRing className="h-4 w-4" /> Ipadala ang paalala sa mga magulang</Button>
          )}
          {dueKids.length === 0 && checkupsSoon.length === 0 && <EmptyState title="Walang kailangang bakuna o check-up ngayong linggo" />}
          {[...overdueKids, ...dueKids.filter((c) => !overdueKids.includes(c))].map((c) => (
            <ChildCard key={c.id} c={c} canEdit onEdit={() => setEditChild(c)} />
          ))}
          {checkupsSoon.map((p) => (
            <Card key={p.id} className="flex items-center gap-3">
              <HeartPulse className="h-5 w-5 shrink-0 text-pink-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{p.name}</p>
                <p className="text-xs text-gray-500">Prenatal check-up: {shortDate(p.nextCheckup)} · {p.purok || "—"}</p>
              </div>
              <button onClick={() => setEditPreg(p)} className="text-xs font-bold text-brand">Ayusin</button>
            </Card>
          ))}
        </div>
      )}

      {tab === "bata" && (
        <div className="space-y-2.5">
          <Button variant="gold" full onClick={() => setAddChild(true)}><Plus className="h-4 w-4" /> Irehistro ang bata</Button>
          <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3">
            <Search className="h-4 w-4 text-gray-400" aria-hidden />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pangalan, magulang, purok..." aria-label="Hanapin" className="w-full bg-transparent py-2.5 outline-none" />
          </label>
          {kids.length === 0 ? <EmptyState icon={<Baby />} title="Wala pang nakarehistrong bata" /> : kids.map((c) => <ChildCard key={c.id} c={c} canEdit onEdit={() => setEditChild(c)} />)}
        </div>
      )}

      {tab === "buntis" && (
        <div className="space-y-2.5">
          <Button variant="gold" full onClick={() => setAddPreg(true)}><Plus className="h-4 w-4" /> Irehistro ang buntis</Button>
          {activePregs.length === 0 ? (
            <EmptyState icon={<HeartPulse />} title="Walang nakarehistrong buntis" />
          ) : (
            activePregs.map((p) => {
              const w = weeksPregnant(p.dueDate);
              return (
                <Card key={p.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{p.name}{w !== null && p.dueDate ? ` · ${w} linggo` : ""}</p>
                    <p className="text-xs text-gray-500">{p.dueDate ? `Due ${shortDate(p.dueDate)}` : "Walang due date"} · {p.purok || "—"}</p>
                    {p.nextCheckup && <p className="text-xs font-semibold text-brand">Check-up: {shortDate(p.nextCheckup)}</p>}
                  </div>
                  <button onClick={() => setEditPreg(p)} className="p-1 text-brand" aria-label={`Ayusin ${p.name}`}><Pencil className="h-4 w-4" /></button>
                </Card>
              );
            })
          )}
        </div>
      )}

      <Modal open={addChild} onClose={() => setAddChild(false)} title="Irehistro ang bata">{addChild && <ChildForm onDone={() => setAddChild(false)} />}</Modal>
      <Modal open={!!editChild} onClose={() => setEditChild(null)} title={editChild?.name ?? "Bata"}>{editChild && <ChildForm key={editChild.id} existing={editChild} onDone={() => setEditChild(null)} />}</Modal>
      <Modal open={addPreg} onClose={() => setAddPreg(false)} title="Irehistro ang buntis">{addPreg && <PregnancyForm onDone={() => setAddPreg(false)} />}</Modal>
      <Modal open={!!editPreg} onClose={() => setEditPreg(null)} title={editPreg?.name ?? "Buntis"}>{editPreg && <PregnancyForm key={editPreg.id} existing={editPreg} onDone={() => setEditPreg(null)} />}</Modal>
    </div>
  );
}

/* ---------------- Resident view ---------------- */

function MyFamilyHealth() {
  const { user } = useAuth();
  const kidsQ = useMemo(() => (user ? query(collection(db, "children"), where("parentId", "==", user.uid)) : null), [user]);
  const pregQ = useMemo(() => (user ? query(collection(db, "pregnancies"), where("userId", "==", user.uid)) : null), [user]);
  const kids = useCollection<Child>(kidsQ);
  const pregs = useCollection<Pregnancy>(pregQ);
  const active = pregs.data.filter((p) => p.status === "active");

  if (kids.loading || pregs.loading) return <Spinner />;
  if (kids.data.length === 0 && active.length === 0) {
    return (
      <EmptyState icon={<Baby />} title="Wala pang record ang anak mo dito">
        Magpa-rehistro sa BHW sa Barangay Health Center. Dalhin ang baby book. Pagkatapos, makikita mo rito ang schedule ng bakuna.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-3">
      {active.map((p) => {
        const w = weeksPregnant(p.dueDate);
        return (
          <Card key={p.id} className="space-y-1 bg-pink-50">
            <p className="flex items-center gap-2 font-extrabold"><HeartPulse className="h-5 w-5 text-pink-600" /> Ang pagbubuntis mo</p>
            {p.dueDate && <p className="text-sm">{w !== null ? `${w} linggo · ` : ""}Due date: {shortDate(p.dueDate)}</p>}
            {p.nextCheckup && <p className="text-sm font-semibold text-brand">Susunod na check-up: {shortDate(p.nextCheckup)}</p>}
          </Card>
        );
      })}
      {kids.data.map((c) => <ChildCard key={c.id} c={c} canEdit={false} />)}
    </div>
  );
}

export default function KalusuganPage() {
  const { canBotika } = useAuth();
  return (
    <div>
      <PageHeader title="Kalusugan" subtitle="Bakuna ng bata at check-up ng buntis" />
      {canBotika && (
        <>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand"><Pencil className="h-3.5 w-3.5" /> Para sa BHW</p>
          <BhwPanel />
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Pamilya ko</p>
        </>
      )}
      <LoginGate message="Mag-login para makita ang schedule ng bakuna ng anak mo.">
        <MyFamilyHealth />
      </LoginGate>
    </div>
  );
}
