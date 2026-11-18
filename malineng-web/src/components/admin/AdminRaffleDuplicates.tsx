"use client";

import { useState } from "react";
import { collection, doc, getDoc, getDocs, writeBatch } from "firebase/firestore";
import { ScanSearch, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { logActivity } from "@/lib/activity";
import { friendlyError, formatDate, timeAgo } from "@/lib/format";
import { normName } from "@/lib/householdMerge";
import type { UserProfile } from "@/lib/types";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/Toast";

interface Person {
  uid: string;
  code: string;
  name: string;
  purok: string;
  info?: Pick<UserProfile, "birthday" | "contact" | "email" | "createdAt" | "suspended">;
}
interface Group {
  why: string;
  people: Person[];
}

/**
 * Developer: look for doubles before the draw. Two kinds are listed: entries that share a code (the code registry should make
 * this impossible) and entries with the same name (which may be one person with two accounts, or two people who share a name).
 * Nothing is removed by itself: the Developer looks at the birthday, number and email and removes the extra entry.
 */
export function AdminRaffleDuplicates({ locked, onChanged }: { locked: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [total, setTotal] = useState(0);

  const check = async () => {
    setBusy(true);
    try {
      const snap = await getDocs(collection(db, "raffleEntries"));
      const all: Person[] = snap.docs.map((d) => ({ uid: d.id, code: String(d.data().code ?? ""), name: String(d.data().name ?? ""), purok: String(d.data().purok ?? "") }));
      setTotal(all.length);
      const byCode = new Map<string, Person[]>();
      const byName = new Map<string, Person[]>();
      for (const p of all) {
        byCode.set(p.code, [...(byCode.get(p.code) ?? []), p]);
        const n = normName(p.name);
        if (n) byName.set(n, [...(byName.get(n) ?? []), p]);
      }
      const found: Group[] = [];
      byCode.forEach((people, code) => people.length > 1 && found.push({ why: `Parehong code: ${code}`, people }));
      byName.forEach((people) => people.length > 1 && found.push({ why: people.every((p) => p.purok === people[0].purok) ? "Parehong pangalan at purok" : "Parehong pangalan", people }));
      // Only the suspected people are looked up (one read each) to show the birthday, number and email.
      for (const g of found) {
        for (const p of g.people) {
          const u = (await getDoc(doc(db, "users", p.uid))).data() as UserProfile | undefined;
          if (u) p.info = { birthday: u.birthday, contact: u.contact, email: u.email, createdAt: u.createdAt, suspended: u.suspended };
        }
      }
      setGroups(found);
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Person) => {
    if (locked) return toast("Nasimulan na ang bunutan. Hindi na pwedeng alisin ang entry.", "error");
    if (!window.confirm(`Alisin ang entry ni ${p.name} (${p.code})? Mawawala ang code niya sa raffle.`)) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "raffleEntries", p.uid));
      batch.delete(doc(db, "raffleCodes", p.code));
      await batch.commit();
      logActivity("Raffle", `Inalis ang dobleng entry ni ${p.name} (${p.code})`, p.uid);
      toast("Inalis ang entry.");
      onChanged();
      await check();
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <div className="space-y-2">
      <Button variant="outline" full loading={busy} onClick={check}>
        <ScanSearch className="h-4 w-4" aria-hidden /> Suriin ang doble
      </Button>
      {groups && (
        <Card className="space-y-3">
          <p className="font-extrabold">
            {groups.length === 0 ? `Walang nakitang doble sa ${total} entry.` : `${groups.length} grupo ang posibleng doble (sa ${total} entry)`}
          </p>
          {groups.map((g, i) => (
            <div key={i} className="space-y-1.5 rounded-xl bg-amber-50 p-2.5">
              <p className="text-xs font-bold text-amber-900">{g.why}</p>
              {g.people.map((p) => (
                <div key={p.uid} className="flex items-start justify-between gap-2 rounded-lg bg-white p-2 text-sm">
                  <div className="min-w-0">
                    <p className="break-words font-bold">{p.name} <span className="font-normal text-gray-500">· {p.purok || "walang purok"}</span></p>
                    <p className="text-xs text-gray-600">{p.code}</p>
                    {p.info && (
                      <p className="text-xs text-gray-500">
                        {p.info.birthday ? `Birthday ${formatDate(p.info.birthday)}` : "Walang birthday"} · {p.info.contact || "walang contact"} · {p.info.email || "walang email"} · nag-register {timeAgo(p.info.createdAt)}
                        {p.info.suspended ? " · SUSPENDED" : ""}
                      </p>
                    )}
                  </div>
                  <button type="button" disabled={locked} onClick={() => remove(p)} aria-label={`Alisin ang entry ni ${p.name}`} className="shrink-0 rounded-lg bg-red-50 p-2 text-red-600 active:bg-red-100 disabled:opacity-40">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ))}
          {groups.length > 0 && <p className="text-xs text-gray-500">Tingnan ang birthday, numero at email. Iisang tao kung magkapareho ang mga ito. Ang magkaibang tao na magkapangalan ay huwag alisin.</p>}
        </Card>
      )}
    </div>
  );
}
