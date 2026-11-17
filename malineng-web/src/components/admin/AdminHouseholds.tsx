"use client";

import { useMemo, useState } from "react";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { Download, GitMerge } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { logActivity } from "@/lib/activity";
import { friendlyError } from "@/lib/format";
import { findDuplicateGroups, mergeHouseholds, type DuplicateGroup } from "@/lib/householdMerge";
import { useToast } from "@/components/Toast";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { usePuroks } from "@/lib/useSettings";
import { downloadCsv } from "@/lib/csv";
import { ageFrom } from "@/lib/age";
import { todayISO } from "@/lib/format";
import type { Household } from "@/lib/types";
import { Button, EmptyState, FilterTabs, Spinner } from "@/components/ui";

const householdsCollection = collection(db, "households");

/** One family that was entered twice (for example both spouses made a household): pick the one to keep and merge the rest into it. */
function DuplicateCard({ group, canMerge }: { group: DuplicateGroup; canMerge: boolean }) {
  const toast = useToast();
  const [keepId, setKeepId] = useState(group.households[0].id);
  const [busy, setBusy] = useState(false);
  const keep = group.households.find((h) => h.id === keepId) ?? group.households[0];
  const others = group.households.filter((h) => h.id !== keep.id);
  const merged = mergeHouseholds(keep, others);

  const merge = async () => {
    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "households", keep.id), { members: merged.members, coHeadIds: merged.coHeadIds, coHeadNames: merged.coHeadNames, updatedAt: serverTimestamp() });
      others.forEach((o) => batch.delete(doc(db, "households", o.id)));
      await batch.commit();
      logActivity("Pamilya", `Pinagsama ang household: ${[keep, ...others].map((h) => h.headName).join(" + ")} (${keep.purok})`, keep.id);
      toast("Napagsama na ang household.");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="space-y-2 rounded-2xl bg-white p-3 shadow-card">
      <p className="text-xs font-bold text-amber-700">{group.reasons.join(" · ")}</p>
      {group.households.map((h) => (
        <label key={h.id} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-sm ${keepId === h.id ? "border-brand bg-brand-light" : "border-gray-200"}`}>
          <input type="radio" name={`keep-${group.households[0].id}`} checked={keepId === h.id} onChange={() => setKeepId(h.id)} className="mt-1" />
          <span className="min-w-0">
            <b className="block truncate">{h.headName}</b>
            <span className="block text-xs text-gray-500">{h.purok}{h.address ? ` · ${h.address}` : ""} · {h.members.length + 1} katao</span>
            <span className="block text-xs text-gray-600">{h.members.map((m) => m.name).join(", ") || "Walang ibang miyembro"}</span>
          </span>
        </label>
      ))}
      <p className="rounded-xl bg-gray-50 p-2.5 text-xs text-gray-700">
        Pagkatapos: <b>{keep.headName}</b> ang puno at ang {others.map((o) => o.headName).join(", ")} ay kasamang puno. {merged.members.length + 1 + merged.coHeadNames.length} ang bilang ng tao, bawat isa ay isang beses lang.
      </p>
      {canMerge ? (
        <Button full loading={busy} onClick={merge}><GitMerge className="h-4 w-4" aria-hidden /> Pagsamahin</Button>
      ) : (
        <p className="text-center text-xs text-gray-500">Kapitan, Secretary o Developer ang makakapagsama.</p>
      )}
    </li>
  );
}

export function AdminHouseholds() {
  const { isSuperAdmin, isAdmin, profile } = useAuth();
  const canMerge = isSuperAdmin || (isAdmin && ["Kapitan", "Secretary"].includes(profile?.position ?? ""));
  const [showDup, setShowDup] = useState(false);
  const { data, loading } = useCollection<Household>(householdsCollection);
  const groups = useMemo(() => findDuplicateGroups(data), [data]);
  const puroks = usePuroks();
  const [purok, setPurok] = useState("Lahat");
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useMemo(() => data.filter((h) => purok === "Lahat" || h.purok === purok).sort((a, b) => a.headName.localeCompare(b.headName)), [data, purok]);

  const stats = useMemo(() => {
    let persons = 0;
    let seniors = 0;
    let minors = 0;
    list.forEach((h) => {
      persons += 1 + (h.coHeadIds?.length ?? 0) + h.members.length; // head + co-heads + members
      h.members.forEach((m) => {
        const a = ageFrom(m.birthday);
        if (a !== null && a >= 60) seniors++;
        if (a !== null && a < 18) minors++;
      });
    });
    return [
      { label: "Household", value: list.length },
      { label: "Katao", value: persons },
      { label: "Senior (60+)", value: seniors },
      { label: "Menor (<18)", value: minors },
    ];
  }, [list]);

  const exportCsv = () => {
    const rows: (string | number)[][] = [["Purok", "Puno ng pamilya", "Address", "Pangalan", "Kaugnayan", "Kasarian", "Birthday", "Edad"]];
    list.forEach((h) => {
      rows.push([h.purok, h.headName, h.address, h.headName, "Puno ng pamilya", "", "", ""]);
      (h.coHeadNames ?? []).forEach((n) => rows.push([h.purok, h.headName, h.address, n, "Kasamang puno", "", "", ""]));
      h.members.forEach((m) => rows.push([h.purok, h.headName, h.address, m.name, m.relation, m.sex, m.birthday, ageFrom(m.birthday) ?? ""]));
    });
    downloadCsv(`households-${purok === "Lahat" ? "lahat" : purok.replace(/\s+/g, "-")}-${todayISO()}.csv`, rows);
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="mb-3 grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-2.5 text-center shadow-card">
            <p className="text-lg font-extrabold tabular-nums">{s.value}</p>
            <p className="text-[0.7rem] font-semibold text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>
      {groups.length > 0 && (
        <button type="button" onClick={() => setShowDup((v) => !v)} className="mb-3 flex w-full items-center justify-between rounded-2xl bg-amber-50 px-3 py-2.5 text-left text-sm font-bold text-amber-900 active:opacity-80">
          <span className="flex items-center gap-2"><GitMerge className="h-4 w-4" aria-hidden /> Posibleng doble: {groups.length} pamilya</span>
          <span className="text-xs underline">{showDup ? "Isara" : "Tingnan"}</span>
        </button>
      )}
      {showDup && groups.length > 0 && (
        <ul className="mb-3 space-y-3">{groups.map((g) => <DuplicateCard key={g.households.map((h) => h.id).join("+")} group={g} canMerge={canMerge} />)}</ul>
      )}
      <FilterTabs label="Purok" value={purok} onChange={setPurok} options={["Lahat", ...puroks].map((p) => ({ value: p, label: p }))} />
      <Button variant="outline" full className="mb-3" onClick={exportCsv} disabled={!list.length}>
        <Download className="h-4 w-4" /> I-export bilang CSV (para sa census / ayuda)
      </Button>

      {list.length === 0 ? (
        <EmptyState title="Wala pang household na nailagay" >Hikayatin ang mga residente: Account → Pamilya ko.</EmptyState>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-card">
          {list.map((h) => (
            <li key={h.id}>
              <button onClick={() => setOpenId(openId === h.id ? null : h.id)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{h.headName}</p>
                  <p className="truncate text-xs text-gray-500">{h.purok}{h.address ? ` · ${h.address}` : ""}{h.coHeadNames?.length ? ` · kasama: ${h.coHeadNames.join(", ")}` : ""}</p>
                </div>
                <span className="shrink-0 rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-bold text-brand">{h.members.length + 1 + (h.coHeadIds?.length ?? 0)} katao</span>
              </button>
              {openId === h.id && (
                <ul className="space-y-1 bg-gray-50 px-4 py-2 text-sm">
                  {h.members.length === 0 && <li className="text-gray-500">Walang ibang miyembro.</li>}
                  {h.members.map((m, i) => {
                    const a = ageFrom(m.birthday);
                    return (
                      <li key={i} className="flex justify-between gap-2">
                        <span>{m.name} <span className="text-gray-500">· {m.relation}</span></span>
                        <span className="shrink-0 text-gray-500">{m.sex === "Lalaki" ? "L" : "B"}{a !== null ? ` · ${a}` : ""}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
