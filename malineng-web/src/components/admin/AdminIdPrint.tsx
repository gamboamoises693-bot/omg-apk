"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { Printer, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import { useVerifiedSet } from "@/lib/useVerifiedSet";
import type { UserProfile } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/ui";

const MAX_IDS = 27;

/** Admin tab: pick residents and print their Barangay IDs on one sheet (9 or 4 per A4 page) to save paper. */
export function AdminIdPrint() {
  const verified = useVerifiedSet();
  const [users, setUsers] = useState<(UserProfile & { id: string })[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [per, setPer] = useState<9 | 4>(9);

  useEffect(() => {
    getDocs(collection(db, "users"))
      .then((s) => setUsers(s.docs.map((d) => ({ id: d.id, ...(d.data() as UserProfile) }))))
      .catch((err) => {
        console.warn("[id print] load failed:", err);
        setError("Hindi ma-load ang listahan. Subukan ulit.");
      });
  }, []);

  // People who can have a printed ID: verified (or staff) and already given an ID number.
  const ready = useMemo(() => (users ?? []).filter((u) => (verified.has(u.id) || u.role !== "resident") && u.idNo), [users, verified]);
  const noNumber = useMemo(() => (users ?? []).filter((u) => (verified.has(u.id) || u.role !== "resident") && !u.idNo).length, [users, verified]);
  const list = useMemo(() => {
    const t = search.trim().toLowerCase();
    return ready.filter((u) => !t || `${u.fullName} ${u.purok ?? ""} ${u.idNo ?? ""}`.toLowerCase().includes(t)).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [ready, search]);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_IDS ? p : [...p, id]));
  const pickShown = () => setPicked((p) => [...new Set([...p, ...list.map((u) => u.id)])].slice(0, MAX_IDS));

  if (error) return <p className="rounded-2xl bg-red-50 p-4 text-center text-sm text-red-700">{error}</p>;
  if (!users) return <Spinner />;

  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-brand-light px-3 py-2 text-sm text-brand-deep">
        Pumili ng mga residente at i-print ang kanilang Barangay ID sa <b>iisang papel</b>: 9 sa isang A4 (maliit) o 4 sa isang A4 (malaki). Hanggang {MAX_IDS} bawat print.
      </p>
      {noNumber > 0 && <p className="rounded-xl bg-gold-light px-3 py-2 text-xs text-yellow-900">{noNumber} ang wala pang ID number. Ang Developer ay pupunta sa Home → Mga miyembro → &ldquo;Gawan ng ID number&rdquo;, o bubuksan nila ang kanilang ID.</p>}

      <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3">
        <Search className="h-4 w-4 text-gray-400" aria-hidden />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hanapin ang pangalan, purok o ID no..." aria-label="Hanapin" className="w-full bg-transparent py-2.5 outline-none" />
      </label>

      <div className="flex items-center justify-between gap-2 text-sm">
        <button type="button" onClick={pickShown} className="font-bold text-brand underline">Piliin ang lahat ng nakikita</button>
        <button type="button" onClick={() => setPicked([])} disabled={picked.length === 0} className="font-bold text-gray-500 underline disabled:opacity-40">Alisin lahat ({picked.length})</button>
      </div>

      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">Walang makita.</p>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-card">
          {list.map((u) => (
            <li key={u.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 active:bg-gray-50">
                <input type="checkbox" checked={picked.includes(u.id)} onChange={() => toggle(u.id)} className="h-5 w-5 shrink-0" />
                <Avatar name={u.fullName} photo={(u.role !== "resident" ? u.photoURL : undefined) || u.faceThumb} size="h-9 w-9" textClass="text-xs" fallbackClass="bg-brand-light text-brand" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{u.fullName}</span>
                  <span className="block truncate text-xs text-gray-500">{u.purok || "Walang purok"} · {u.idNo}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="sticky bottom-20 space-y-2 rounded-2xl bg-white p-3 shadow-float">
        <div className="grid grid-cols-2 gap-2 text-sm font-bold">
          {([9, 4] as const).map((n) => (
            <button key={n} type="button" onClick={() => setPer(n)} className={`rounded-xl border py-2 ${per === n ? "border-brand bg-brand-light text-brand" : "border-gray-200 text-gray-600"}`}>{n === 9 ? "9 sa isang A4 (maliit)" : "4 sa isang A4 (malaki)"}</button>
          ))}
        </div>
        <Link
          href={picked.length ? `/barangay-id/print/?ids=${picked.join(",")}&per=${per}` : "#"}
          aria-disabled={picked.length === 0}
          onClick={(e) => picked.length === 0 && e.preventDefault()}
          className={`flex items-center justify-center gap-2 rounded-xl py-3 text-center font-bold text-white ${picked.length ? "bg-brand active:opacity-80" : "bg-gray-300"}`}
        >
          <Printer className="h-4 w-4" aria-hidden /> I-print ang {picked.length} ID ({Math.ceil(picked.length / per) || 0} pahina)
        </Link>
      </div>
    </div>
  );
}
