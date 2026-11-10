"use client";

import { useEffect, useMemo, useState } from "react";
import { FieldPath, addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { Cake, Download, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { usePuroks } from "@/lib/useSettings";
import { logActivity } from "@/lib/activity";
import { ageFrom } from "@/lib/age";
import { downloadCsv } from "@/lib/csv";
import { friendlyError, todayISO } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import type { UserProfile } from "@/lib/types";
import { Badge, Button, EmptyState, ErrorText, FilterTabs, Input, Modal, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";

const SECTORS = ["Senior", "PWD", "Solo Parent"] as const;
type Sector = (typeof SECTORS)[number];

interface SectorMember {
  id: string;
  fullName: string;
  birthday: string;
  purok: string;
  contact: string;
  sectors: Sector[];
  /** OSCA / PWD / Solo Parent ID numbers. */
  idNumber: string;
  notes: string;
  userId: string;
  /** e.g. { "2026-Q4": true } */
  pension?: Record<string, boolean>;
}

const membersCol = collection(db, "sectorMembers");
const usersCol = collection(db, "users");

function currentQuarter(d = new Date()): string {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

/** Days until the next birthday (0 = today). */
function daysToBirthday(birthday: string, now = new Date()): number | null {
  if (!birthday) return null;
  const [, m, d] = birthday.split("-").map(Number);
  if (!m || !d) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), m - 1, d);
  if (next < today) next = new Date(now.getFullYear() + 1, m - 1, d);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

function MemberForm({ existing, users, onDone }: { existing?: SectorMember; users: (UserProfile & { id: string })[]; onDone: () => void }) {
  const toast = useToast();
  const puroks = usePuroks();
  const [fullName, setFullName] = useState(existing?.fullName ?? "");
  const [birthday, setBirthday] = useState(existing?.birthday ?? "");
  const [purok, setPurok] = useState(existing?.purok ?? "");
  const [contact, setContact] = useState(existing?.contact ?? "");
  const [sectors, setSectors] = useState<Sector[]>(existing?.sectors ?? ["Senior"]);
  const [idNumber, setIdNumber] = useState(existing?.idNumber ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [userId, setUserId] = useState(existing?.userId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Suggest linking to a website account with the same name.
  const match = useMemo(() => {
    const t = fullName.trim().toLowerCase();
    if (t.length < 4 || userId) return null;
    return users.find((u) => u.fullName.trim().toLowerCase() === t) ?? null;
  }, [fullName, users, userId]);
  const linked = users.find((u) => u.id === userId);

  const toggle = (s: Sector) => setSectors((all) => (all.includes(s) ? all.filter((x) => x !== s) : [...all, s]));

  const save = async () => {
    setError("");
    if (!fullName.trim()) return setError("Ilagay ang buong pangalan.");
    if (sectors.length === 0) return setError("Pumili ng kahit isang sektor.");
    const age = ageFrom(birthday);
    if (sectors.includes("Senior") && age !== null && age < 60) return setError(`${age} taong gulang pa lang. Ang Senior ay 60 pataas.`);
    setBusy(true);
    try {
      const data = {
        fullName: fullName.trim().slice(0, 120),
        birthday,
        purok,
        contact: normalizePhone(contact) || contact.trim().slice(0, 20),
        sectors,
        idNumber: idNumber.trim().slice(0, 60),
        notes: notes.trim().slice(0, 200),
        userId,
      };
      if (existing) {
        await updateDoc(doc(db, "sectorMembers", existing.id), data);
        logActivity("Sektor", `Inayos ang record ni ${data.fullName} (${sectors.join(", ")})`, existing.id);
      } else {
        const ref = await addDoc(membersCol, { ...data, pension: {}, createdAt: serverTimestamp() });
        logActivity("Sektor", `Idinagdag si ${data.fullName} (${sectors.join(", ")})`, ref.id);
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
      <Input label="Buong pangalan" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
      {match && (
        <button onClick={() => { setUserId(match.id); setBirthday(birthday || match.birthday || ""); setPurok(purok || match.purok || ""); setContact(contact || match.contact || ""); }} className="w-full rounded-xl bg-brand-light p-2.5 text-left text-xs text-brand-deep">
          May account sa website: <b>{match.fullName}</b> ({match.purok || "—"}). <u>I-link</u> para lumabas ang sektor sa Barangay ID niya.
        </button>
      )}
      {linked && (
        <p className="flex items-center justify-between rounded-xl bg-emerald-50 p-2.5 text-xs text-emerald-900">
          <span>Naka-link sa account ni <b>{linked.fullName}</b></span>
          <button onClick={() => setUserId("")} className="font-bold underline">Alisin</button>
        </p>
      )}
      <div>
        <p className="mb-1 text-[0.85rem] font-semibold text-gray-700">Sektor</p>
        <div className="flex flex-wrap gap-1.5">
          {SECTORS.map((s) => (
            <button key={s} type="button" onClick={() => toggle(s)} aria-pressed={sectors.includes(s)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${sectors.includes(s) ? "bg-brand text-white" : "bg-gray-100 text-gray-700"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input label="Birthday" type="date" max={todayISO()} value={birthday} onChange={(e) => setBirthday(e.target.value)} />
        <Select label="Purok" options={puroks} placeholder="Piliin" value={purok} onChange={(e) => setPurok(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input label="ID no. (OSCA/PWD/Solo)" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} maxLength={60} />
        <Input label="Contact" type="tel" inputMode="tel" value={contact} onChange={(e) => setContact(e.target.value)} />
      </div>
      <Input label="Tala (optional)" placeholder="hal. Bedridden, naka-wheelchair, 2 anak" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} />
      <ErrorText>{error}</ErrorText>
      <Button full loading={busy} onClick={save}>I-save</Button>
    </div>
  );
}

/** Officers: Senior / PWD / Solo Parent registry with pension tracking per quarter. */
export function AdminSektor() {
  const toast = useToast();
  const { data, loading, error } = useCollection<SectorMember>(membersCol);
  const users = useCollection<UserProfile & { id: string }>(usersCol);
  const puroks = usePuroks();
  const [tab, setTab] = useState<Sector | "Lahat">("Senior");
  const [purokFilter, setPurokFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SectorMember | null>(null);
  const [adding, setAdding] = useState(false);
  const quarter = currentQuarter();

  const count = (s: Sector) => data.filter((m) => m.sectors.includes(s)).length;
  const list = useMemo(() => {
    const t = search.trim().toLowerCase();
    return data
      .filter((m) => (tab === "Lahat" ? true : m.sectors.includes(tab)))
      .filter((m) => !purokFilter || m.purok === purokFilter)
      .filter((m) => !t || `${m.fullName} ${m.idNumber} ${m.notes}`.toLowerCase().includes(t))
      .sort((a, b) => a.purok.localeCompare(b.purok) || a.fullName.localeCompare(b.fullName));
  }, [data, tab, purokFilter, search]);

  // Senior birthdays in the next 7 days.
  const birthdays = useMemo(
    () =>
      data
        .filter((m) => m.sectors.includes("Senior"))
        .map((m) => ({ m, days: daysToBirthday(m.birthday), age: ageFrom(m.birthday) }))
        .filter((x) => x.days !== null && x.days <= 7)
        .sort((a, b) => (a.days ?? 0) - (b.days ?? 0)),
    [data],
  );

  // Publish this week's senior birthdays (first name + age only) for the Home greeting.
  const birthdayKey = birthdays.map((b) => `${b.m.id}:${b.days}`).join(",");
  useEffect(() => {
    if (loading) return;
    const names = birthdays
      .filter((b) => b.days === 0)
      .map((b) => `${b.m.fullName.split(" ")[0]}${b.age !== null ? ` (${b.age})` : ""}`);
    setDoc(doc(db, "stats", "birthdays"), { date: todayISO(), seniors: names.slice(0, 20) }).catch((err) => console.warn("[sektor] birthdays publish failed:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, birthdayKey]);

  const togglePension = async (m: SectorMember) => {
    const paid = !m.pension?.[quarter];
    try {
      await updateDoc(doc(db, "sectorMembers", m.id), new FieldPath("pension", quarter), paid);
      logActivity("Sektor", `${paid ? "Natanggap" : "Ibinalik sa hindi pa"} ang pensyon ${quarter}: ${m.fullName}`, m.id);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const remove = async (m: SectorMember) => {
    if (!confirm(`Burahin si ${m.fullName} sa registry?`)) return;
    try {
      await deleteDoc(doc(db, "sectorMembers", m.id));
      logActivity("Sektor", `Binura sa registry: ${m.fullName}`, m.id);
      setEditing(null);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const exportCsv = () =>
    downloadCsv(`sektor-${tab}-${todayISO()}.csv`, [
      ["Pangalan", "Sektor", "Edad", "Birthday", "Purok", "ID no.", "Contact", `Pensyon ${quarter}`, "Tala"],
      ...list.map((m) => [m.fullName, m.sectors.join(", "), ageFrom(m.birthday) ?? "", m.birthday, m.purok, m.idNumber, m.contact, m.pension?.[quarter] ? "Oo" : "Hindi pa", m.notes]),
    ]);

  if (loading) return <Spinner />;
  if (error) return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>;

  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        {SECTORS.map((s) => (
          <button key={s} onClick={() => setTab(s)} className={`rounded-2xl bg-white p-2.5 shadow-card ${tab === s ? "ring-2 ring-brand" : ""}`}>
            <p className="text-xl font-extrabold text-brand">{count(s)}</p>
            <p className="text-[0.7rem] font-semibold text-gray-600">{s}</p>
          </button>
        ))}
      </div>

      {birthdays.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-2xl bg-gold-light p-3 text-[0.82rem] text-yellow-900">
          <Cake className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            <b>Kaarawan ng senior (7 araw):</b>{" "}
            {birthdays.map((b) => `${b.m.fullName}${b.days === 0 ? " (NGAYON)" : ` (${b.days} araw)`}`).join(", ")}
          </p>
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Button variant="gold" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Idagdag</Button>
        <Button variant="outline" onClick={exportCsv} disabled={list.length === 0}><Download className="h-4 w-4" /> CSV</Button>
      </div>

      <FilterTabs
        label="Sektor"
        value={tab}
        onChange={setTab}
        options={[...SECTORS.map((s) => ({ value: s, label: s === "Solo Parent" ? "Solo" : s })), { value: "Lahat" as const, label: "Lahat" }]}
      />
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
        <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3">
          <Search className="h-4 w-4 text-gray-400" aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pangalan, ID no..." aria-label="Hanapin" className="w-full bg-transparent py-2.5 outline-none" />
        </label>
        <select value={purokFilter} onChange={(e) => setPurokFilter(e.target.value)} aria-label="Purok" className="rounded-xl border border-gray-200 bg-white px-2 text-sm">
          <option value="">Lahat ng purok</option>
          {puroks.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {list.length === 0 ? (
        <EmptyState title="Wala pang nakalista dito" />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-card">
          {list.map((m) => {
            const age = ageFrom(m.birthday);
            const paid = !!m.pension?.[quarter];
            return (
              <li key={m.id} className="flex items-center gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{m.fullName}{age !== null ? ` (${age})` : ""}</p>
                  <p className="truncate text-xs text-gray-500">
                    {[m.purok, m.sectors.join(", "), m.idNumber ? `ID ${m.idNumber}` : "", m.notes, m.userId ? "may account" : ""].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {m.sectors.includes("Senior") && (
                  <button onClick={() => togglePension(m)} className="shrink-0" aria-label={`Pensyon ${quarter} ni ${m.fullName}: ${paid ? "natanggap" : "hindi pa"}`}>
                    <Badge color={paid ? "green" : "gold"}>{paid ? `✓ ${quarter.slice(5)}` : `Hindi pa ${quarter.slice(5)}`}</Badge>
                  </button>
                )}
                <button onClick={() => setEditing(m)} className="p-1.5 text-brand" aria-label={`Ayusin si ${m.fullName}`}>
                  <Pencil className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-center text-[0.7rem] text-gray-500">Pindutin ang badge para markahan na natanggap ang pensyon ngayong {quarter}.</p>

      <Modal open={adding} onClose={() => setAdding(false)} title="Idagdag sa registry">
        {adding && <MemberForm users={users.data} onDone={() => setAdding(false)} />}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.fullName ?? "Record"}>
        {editing && (
          <>
            <MemberForm key={editing.id} existing={editing} users={users.data} onDone={() => setEditing(null)} />
            <button onClick={() => remove(editing)} className="mt-3 flex w-full items-center justify-center gap-1.5 py-2 text-sm font-semibold text-red-700">
              <Trash2 className="h-4 w-4" /> Burahin sa registry
            </button>
          </>
        )}
      </Modal>
    </div>
  );
}
