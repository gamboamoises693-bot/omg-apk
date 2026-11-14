"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, doc, getCountFromServer, getDoc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logActivity } from "@/lib/activity";
import { friendlyError } from "@/lib/format";
import { Button, Card, Input } from "@/components/ui";
import { useToast } from "@/components/Toast";

interface Group {
  key: string;
  label: string;
  hint: string;
  collections: string[];
  /** Also deletes settings/raffle (the setup). */
  setup?: boolean;
  /** Ticked by "Piliin para sa simulation". */
  sim: boolean;
}

const GROUPS: Group[] = [
  { key: "entries", label: "Mga entry ng raffle", hint: "Ang mga verified ay makakakuha ng bagong entry code pagbukas nila ng app (habang bukas ang raffle).", collections: ["raffleEntries"], sim: true },
  { key: "results", label: "Resulta ng bunutan at mga na-claim na premyo", hint: "Lahat ng round, mananalo, reserba at QR claims.", collections: ["raffleRounds", "rafflePublicRounds", "raffleClaims", "rafflePublic", "raffleResult"], sim: true },
  { key: "donations", label: "Mga donasyon at resibo", hint: "Mga pangako at resibo. Mawawala rin ang resibo sa donor.", collections: ["raffleDonations"], sim: true },
  { key: "sponsors", label: "Mga sponsor", hint: "Ang listahan ng sponsor na nakikita ng lahat.", collections: ["raffleSponsors"], sim: true },
  { key: "setup", label: "Setup ng raffle", hint: "Petsa, mga round at premyo, at ang on/off switch. Hindi kasama sa simulation.", collections: [], setup: true, sim: false },
];

/** Developer: clear the simulation data so the real raffle starts clean. Nothing else on the site is touched. */
export function AdminRaffleReset({ onDone }: { onDone?: () => void }) {
  const toast = useToast();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [received, setReceived] = useState(0);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next: Record<string, number> = {};
      for (const g of GROUPS) {
        let n = 0;
        for (const c of g.collections) n += (await getCountFromServer(collection(db, c))).data().count;
        if (g.setup) n = (await getDoc(doc(db, "settings", "raffle"))).exists() ? 1 : 0;
        next[g.key] = n;
      }
      setCounts(next);
      setReceived((await getCountFromServer(query(collection(db, "raffleDonations"), where("status", "==", "received")))).data().count);
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const chosen = GROUPS.filter((g) => picked[g.key]);
  const totalChosen = chosen.reduce((sum, g) => sum + (counts[g.key] ?? 0), 0);
  const canRun = chosen.length > 0 && typed.trim().toUpperCase() === "RESET" && !busy;

  const run = async () => {
    setBusy(true);
    try {
      const done: string[] = [];
      for (const g of chosen) {
        let n = 0;
        for (const c of g.collections) {
          const snap = await getDocs(collection(db, c));
          for (let i = 0; i < snap.docs.length; i += 400) {
            const batch = writeBatch(db);
            snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
          n += snap.docs.length;
        }
        if (g.setup) {
          const batch = writeBatch(db);
          batch.delete(doc(db, "settings", "raffle"));
          await batch.commit();
          n += 1;
        }
        done.push(`${g.label}: ${n}`);
      }
      logActivity("Raffle", `Ibinalik sa dati (simulation): ${done.join("; ")}`);
      toast("Tapos na. Ibinalik na sa dati ang napili.");
      setTyped("");
      setPicked({});
      await load();
      onDone?.();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3 border-2 border-red-200">
      <div>
        <h2 className="font-extrabold text-red-800">Simulation: ibalik sa dati</h2>
        <p className="text-xs text-gray-600">Burahin ang data ng pagsubok para malinis ang totoong raffle. Ang raffle lang ang apektado: walang ibang bahagi ng site ang mababago.</p>
      </div>

      {received > 0 && (
        <p className="rounded-xl bg-yellow-50 p-2.5 text-sm font-semibold text-yellow-900">
          Mag-ingat: may <b>{received}</b> donasyon na may resibo na. Kung totoong donasyon ang mga ito, <b>huwag</b> burahin ang &quot;Mga donasyon at resibo&quot;.
        </p>
      )}

      <ul className="space-y-2">
        {GROUPS.map((g) => (
          <li key={g.key}>
            <label className="flex items-start gap-3 rounded-xl bg-surface p-3">
              <input type="checkbox" className="mt-1 h-5 w-5" checked={!!picked[g.key]} disabled={busy || (counts[g.key] ?? 0) === 0} onChange={(e) => setPicked((p) => ({ ...p, [g.key]: e.target.checked }))} />
              <span className="min-w-0">
                <span className="block font-bold">{g.label} <span className="font-normal text-gray-500">({loading ? "…" : counts[g.key] ?? 0})</span></span>
                <span className="block text-xs text-gray-600">{g.hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={busy} onClick={() => setPicked(Object.fromEntries(GROUPS.filter((g) => g.sim && (counts[g.key] ?? 0) > 0).map((g) => [g.key, true])))}>Piliin para sa simulation</Button>
        <Button variant="outline" disabled={busy} onClick={() => setPicked({})}>Alisin ang pili</Button>
      </div>

      <Input label='I-type ang RESET para ituloy' value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="RESET" disabled={busy} hint="Hindi na ito maibabalik pagkatapos." />
      <Button variant="danger" full loading={busy} disabled={!canRun} onClick={run}>
        Burahin ang napili ({totalChosen})
      </Button>
      <p className="text-xs text-gray-500">Pagkatapos: i-on ang raffle at, kung gusto mong masama agad ang lahat ng verified, pindutin ang &quot;Isama ang lahat ng verified na wala pang entry&quot;.</p>
    </Card>
  );
}
