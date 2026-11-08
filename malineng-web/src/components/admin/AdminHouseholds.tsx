"use client";

import { useMemo, useState } from "react";
import { collection } from "firebase/firestore";
import { Download } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { usePuroks } from "@/lib/useSettings";
import { downloadCsv } from "@/lib/csv";
import { ageFrom } from "@/lib/age";
import { todayISO } from "@/lib/format";
import type { Household } from "@/lib/types";
import { Button, EmptyState, Spinner } from "@/components/ui";

const householdsCollection = collection(db, "households");

export function AdminHouseholds() {
  const { data, loading } = useCollection<Household>(householdsCollection);
  const puroks = usePuroks();
  const [purok, setPurok] = useState("Lahat");
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useMemo(() => data.filter((h) => purok === "Lahat" || h.purok === purok).sort((a, b) => a.headName.localeCompare(b.headName)), [data, purok]);

  const stats = useMemo(() => {
    let persons = 0;
    let seniors = 0;
    let minors = 0;
    list.forEach((h) => {
      persons += 1 + h.members.length; // head + members
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
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
        {["Lahat", ...puroks].map((p) => (
          <button key={p} onClick={() => setPurok(p)} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${purok === p ? "bg-brand text-white" : "bg-white text-gray-600 shadow-card"}`}>
            {p}
          </button>
        ))}
      </div>
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
                  <p className="truncate text-xs text-gray-500">{h.purok}{h.address ? ` · ${h.address}` : ""}</p>
                </div>
                <span className="shrink-0 rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-bold text-brand">{h.members.length + 1} katao</span>
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
