"use client";

import { useMemo, useState } from "react";
import { collection, query, where } from "firebase/firestore";
import { AlertTriangle, Minus, Plus, UserRound, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { useVerifiedSet } from "@/lib/useVerifiedSet";
import { usePuroks } from "@/lib/useSettings";
import { logActivity } from "@/lib/activity";
import { ageFrom } from "@/lib/age";
import { friendlyError, tsToMillis } from "@/lib/format";
import {
  DISPENSE_REASONS,
  REPEAT_WARN_DAYS,
  dispenseMedicines,
  qtyLabel,
  residentKeyOf,
  stockStatus,
  type Medicine,
  type MedicineLog,
} from "@/lib/botika";
import type { UserProfile } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Button, Card, ErrorText, Input, Select } from "@/components/ui";
import { useToast } from "@/components/Toast";

type UserRow = UserProfile & { id: string };
interface Line {
  medicineId: string;
  qty: number;
}

const usersCol = collection(db, "users");

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-3 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {n}. {title}
      </p>
      {children}
    </Card>
  );
}

/** Give medicine to a resident (with or without an account). Stock is reduced in one transaction. */
export function BotikaDispense({ meds, onDone }: { meds: Medicine[]; onDone: () => void }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const puroks = usePuroks();
  const verified = useVerifiedSet();
  const users = useCollection<UserRow>(usersCol);

  // Resident
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<UserRow | null>(null);
  const [walkInPurok, setWalkInPurok] = useState("");
  // Medicines
  const [lines, setLines] = useState<Line[]>([]);
  const [reason, setReason] = useState<string>(DISPENSE_REASONS[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const residentName = picked ? picked.fullName : search.trim();
  const purok = picked ? picked.purok : walkInPurok;
  const key = residentName && purok ? residentKeyOf(picked?.id ?? "", residentName, purok) : "";

  const matches = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (picked || t.length < 2) return [];
    return users.data.filter((u) => u.fullName.toLowerCase().includes(t)).slice(0, 5);
  }, [users.data, search, picked]);

  // Past medicine of this resident, for the "nakatanggap na" warning.
  const pastQ = useMemo(() => (key ? query(collection(db, "medicineLogs"), where("residentKey", "==", key)) : null), [key]);
  const past = useCollection<MedicineLog>(pastQ);

  const available = meds.filter((m) => m.stock > 0 && !lines.some((l) => l.medicineId === m.id));
  const byId = new Map(meds.map((m) => [m.id, m]));

  const warnings = useMemo(() => {
    const out: string[] = [];
    const since = Date.now() - REPEAT_WARN_DAYS * 86_400_000;
    for (const line of lines) {
      const m = byId.get(line.medicineId);
      if (!m) continue;
      if (m.needsPrescription) out.push(`${m.name}: kailangan ng reseta. Tingnan muna ang reseta.`);
      if (stockStatus(m) === "expired") out.push(`${m.name}: EXPIRED na ang stock na ito.`);
      const recent = past.data
        .filter((l) => l.type === "dispense" && tsToMillis(l.createdAt) >= since)
        .flatMap((l) => l.items.filter((i) => i.medicineId === m.id).map((i) => ({ i, at: l.createdAt })))
        .sort((a, b) => tsToMillis(b.at) - tsToMillis(a.at))[0];
      if (recent) {
        const date = recent.at?.toDate().toLocaleDateString("fil-PH", { month: "short", day: "numeric" }) ?? "kamakailan";
        out.push(`Nakatanggap na si ${residentName.split(" ")[0]} ng ${m.name} noong ${date} (${qtyLabel(recent.i.qty, m.form)}).`);
      }
    }
    return out;
    // byId is rebuilt from meds each render; meds is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, meds, past.data, residentName]);

  const setQty = (id: string, qty: number) => setLines((ls) => ls.map((l) => (l.medicineId === id ? { ...l, qty: Math.max(1, Math.min(qty, byId.get(id)?.stock ?? qty)) } : l)));

  const reset = () => {
    setSearch("");
    setPicked(null);
    setWalkInPurok("");
    setLines([]);
    setNote("");
    setError("");
  };

  const save = async () => {
    if (!user || !profile) return;
    setError("");
    setBusy(true);
    try {
      await dispenseMedicines(
        { residentId: picked?.id ?? "", residentName, purok, reason, note, items: lines },
        { uid: user.uid, name: profile.fullName },
      );
      const what = lines.map((l) => { const m = byId.get(l.medicineId); return m ? `${m.name} × ${l.qty}` : ""; }).filter(Boolean).join(", ");
      logActivity("Botika", `Nagbigay ng ${what} kay ${residentName} (${purok})`, picked?.id ?? "");
      toast(`Naibigay kay ${residentName}. Nabawas na sa stock.`);
      reset();
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const age = picked ? ageFrom(picked.birthday ?? "") : null;

  return (
    <div>
      <Section n={1} title="Residente">
        {picked ? (
          <div className="flex items-center gap-3 rounded-xl bg-brand-light p-3">
            <Avatar name={picked.fullName} photo={picked.role !== "resident" ? picked.photoURL : undefined} size="h-10 w-10" textClass="text-xs" fallbackClass="bg-brand text-gold" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{picked.fullName} <VerifiedBadge show={verified.has(picked.id)} /></p>
              <p className="truncate text-xs text-gray-600">{picked.purok || "Walang purok"}{age !== null ? ` · ${age} taong gulang` : ""}</p>
            </div>
            <button onClick={() => { setPicked(null); setSearch(""); }} className="rounded-full p-1.5 active:bg-white" aria-label="Palitan ang residente">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <Input label="Pangalan" placeholder="I-type ang pangalan..." value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
            {matches.length > 0 && (
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100">
                {matches.map((u) => (
                  <li key={u.id}>
                    <button onClick={() => setPicked(u)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm active:bg-gray-50">
                      <UserRound className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-semibold">{u.fullName} <VerifiedBadge show={verified.has(u.id)} /></span>
                      <span className="shrink-0 text-xs text-gray-500">{u.purok}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {search.trim().length >= 2 && (
              <div className="space-y-2 rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Walang account? Piliin lang ang purok para kay <b>{search.trim()}</b>.</p>
                <Select label="Purok" options={puroks} placeholder="Piliin ang purok" value={walkInPurok} onChange={(e) => setWalkInPurok(e.target.value)} />
              </div>
            )}
          </>
        )}
      </Section>

      <Section n={2} title="Gamot">
        {lines.map((l) => {
          const m = byId.get(l.medicineId);
          if (!m) return null;
          return (
            <div key={l.medicineId} className="flex items-center gap-2 rounded-xl border border-gray-200 p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{m.name}</p>
                <p className="text-xs text-gray-500">Natitira: {qtyLabel(m.stock, m.form)}</p>
              </div>
              <button onClick={() => setQty(m.id, l.qty - 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100" aria-label={`Bawasan ang ${m.name}`}>
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                inputMode="numeric"
                value={l.qty}
                onChange={(e) => setQty(m.id, Math.floor(Number(e.target.value) || 1))}
                className="w-12 rounded-lg border border-gray-200 py-1 text-center font-bold"
                aria-label={`Dami ng ${m.name}`}
              />
              <button onClick={() => setQty(m.id, l.qty + 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white" aria-label={`Dagdagan ang ${m.name}`}>
                <Plus className="h-4 w-4" />
              </button>
              <button onClick={() => setLines((ls) => ls.filter((x) => x.medicineId !== m.id))} className="p-1 text-gray-400" aria-label={`Alisin ang ${m.name}`}>
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}

        {available.length > 0 && lines.length < 20 ? (
          <label className="block">
            <span className="mb-1 block text-[0.85rem] font-semibold text-gray-700">{lines.length ? "Magdagdag pa ng gamot" : "Piliin ang gamot"}</span>
            <select
              value=""
              onChange={(e) => e.target.value && setLines((ls) => [...ls, { medicineId: e.target.value, qty: 1 }])}
              className="w-full rounded-xl border border-dashed border-brand bg-white px-3 py-2.5 text-brand"
            >
              <option value="">+ Pumili...</option>
              {available.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.stock} {m.form})
                </option>
              ))}
            </select>
          </label>
        ) : (
          lines.length === 0 && <p className="text-sm text-gray-500">Walang gamot na may stock.</p>
        )}

        <Select label="Dahilan / Sakit" options={DISPENSE_REASONS} value={reason} onChange={(e) => setReason(e.target.value)} />
        <Input label="Tala (optional)" placeholder="hal. May reseta mula RHU" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      </Section>

      {warnings.length > 0 && (
        <ul className="mb-3 space-y-1.5 rounded-xl bg-gold-light p-3 text-[0.82rem] text-yellow-900">
          {warnings.map((w) => (
            <li key={w} className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      <ErrorText>{error}</ErrorText>
      <Button full className="mt-2" loading={busy} disabled={!residentName || !purok || lines.length === 0} onClick={save}>
        I-save at ibawas sa stock
      </Button>
    </div>
  );
}
