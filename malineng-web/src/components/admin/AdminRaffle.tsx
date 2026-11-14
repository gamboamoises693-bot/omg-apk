"use client";

import { useEffect, useState } from "react";
import { Timestamp, collection, doc, getCountFromServer, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { Dices } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { logActivity } from "@/lib/activity";
import { friendlyError } from "@/lib/format";
import { verifiedSetRef } from "@/lib/verified";
import { DEFAULT_START_ISO, MAX_RESERVES, formatWhen, maskName, newCode, useNow, useRaffle, type RaffleEntry } from "@/lib/raffle";
import { Button, Card, Input, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";

interface Winner {
  uid: string;
  code: string;
  name: string;
  purok: string;
}

interface ResultDoc {
  winners: Winner[];
  total: number;
  active: number;
  log?: { at: string; by: string; note: string }[];
}

/** datetime-local value (in the device's time zone) from a Timestamp, or a fallback. */
function toInput(ts?: Timestamp, fallbackIso?: string): string {
  const d = ts ? ts.toDate() : fallbackIso ? new Date(fallbackIso) : null;
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Fair shuffle with crypto randomness (Fisher-Yates). */
function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  const buf = new Uint32Array(1);
  for (let i = a.length - 1; i > 0; i--) {
    // Rejection sampling avoids modulo bias.
    const limit = Math.floor(0x100000000 / (i + 1)) * (i + 1);
    let r: number;
    do {
      crypto.getRandomValues(buf);
      r = buf[0];
    } while (r >= limit);
    const j = r % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Developer: set up the raffle, add missing verified people, draw the winner and the reserves. */
export function AdminRaffle() {
  const { user } = useAuth();
  const toast = useToast();
  const { config, pub, loaded } = useRaffle();
  const now = useNow(1000);
  const [enabled, setEnabled] = useState(false);
  const [startAt, setStartAt] = useState(toInput(undefined, DEFAULT_START_ISO));
  const [cutoffAt, setCutoffAt] = useState("");
  const [drawAt, setDrawAt] = useState("");
  const [prize, setPrize] = useState("");
  const [loadedForm, setLoadedForm] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState<ResultDoc | null>(null);
  const [reel, setReel] = useState("");
  const [note, setNote] = useState("");

  // Fill the form once from what is saved.
  useEffect(() => {
    if (!loaded || loadedForm) return;
    setEnabled(config?.enabled ?? false);
    setStartAt(toInput(config?.startAt, DEFAULT_START_ISO));
    setCutoffAt(toInput(config?.cutoffAt));
    setDrawAt(toInput(config?.drawAt));
    setPrize(config?.prize ?? "");
    setLoadedForm(true);
  }, [loaded, loadedForm, config]);

  const refresh = async () => {
    try {
      setCount((await getCountFromServer(collection(db, "raffleEntries"))).data().count);
      const r = await getDoc(doc(db, "raffleResult", "current"));
      setResult(r.exists() ? (r.data() as ResultDoc) : null);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pub?.active, pub?.code]);

  if (!loaded) return <Spinner />;

  const cutoffMs = config?.cutoffAt?.toMillis() ?? Infinity;
  const drawMs = config?.drawAt?.toMillis() ?? Infinity;
  const canDraw = !!config?.enabled && now >= cutoffMs && now >= drawMs && !pub;

  const save = async () => {
    if (!startAt || !cutoffAt || !drawAt) return toast("Ilagay ang simula, cutoff at oras ng bunutan.", "error");
    const s = new Date(startAt).getTime();
    const c = new Date(cutoffAt).getTime();
    const d = new Date(drawAt).getTime();
    if (!(s < c)) return toast("Dapat mas maaga ang simula kaysa sa cutoff.", "error");
    if (!(c <= d)) return toast("Ang bunutan ay dapat pagkatapos o kasabay ng cutoff.", "error");
    if (pub) return toast("Tapos na ang raffle. Hindi na mababago ang setup.", "error");
    setBusy("save");
    try {
      await setDoc(doc(db, "settings", "raffle"), {
        enabled,
        startAt: Timestamp.fromMillis(s),
        cutoffAt: Timestamp.fromMillis(c),
        drawAt: Timestamp.fromMillis(d),
        prize: prize.trim().slice(0, 120),
        updatedAt: serverTimestamp(),
      });
      logActivity("Raffle", `Na-save ang setup ng raffle (${enabled ? "bukas" : "sarado"})`);
      toast("Na-save ang setup ng raffle.");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy("");
    }
  };

  /** Adds an entry for every verified resident who has none yet (people who never opened the app). */
  const sync = async () => {
    if (!confirm("Magdagdag ng entry sa lahat ng verified na wala pang entry? Hindi isasama ang admin at suspended.")) return;
    setBusy("sync");
    try {
      const [setSnap, entrySnap] = await Promise.all([getDoc(verifiedSetRef()), getDocs(collection(db, "raffleEntries"))]);
      const have = new Set(entrySnap.docs.map((d) => d.id));
      const uids = ((setSnap.data()?.uids as string[] | undefined) ?? []).filter((u) => !have.has(u));
      let added = 0;
      let batch = writeBatch(db);
      let inBatch = 0;
      for (const uid of uids) {
        const u = await getDoc(doc(db, "users", uid));
        const data = u.data();
        if (!data || data.role !== "resident" || data.suspended === true) continue;
        batch.set(doc(db, "raffleEntries", uid), { uid, code: newCode(), name: String(data.fullName ?? "").slice(0, 120) || "Residente", purok: String(data.purok ?? "").slice(0, 40), createdAt: serverTimestamp() });
        added++;
        inBatch++;
        if (inBatch >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          inBatch = 0;
        }
      }
      if (inBatch > 0) await batch.commit();
      logActivity("Raffle", `Nagdagdag ng ${added} entry para sa mga verified`);
      toast(added ? `Nagdagdag ng ${added} entry.` : "Wala nang kailangang idagdag.");
      refresh();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy("");
    }
  };

  const draw = async () => {
    if (!user) return;
    if (!confirm("Simulan ang bunutan? Isang beses lang ito at hindi na mababago ang resulta.")) return;
    setBusy("draw");
    try {
      const snap = await getDocs(collection(db, "raffleEntries"));
      const entries = snap.docs.map((d) => d.data() as RaffleEntry);
      if (entries.length === 0) throw new Error("Walang entry sa raffle.");
      // A short roll of names for the show; the result comes from the fair shuffle below.
      const names = entries.map((e) => maskName(e.name));
      const roll = setInterval(() => setReel(names[Math.floor(Math.random() * names.length)]), 70);
      await new Promise((r) => setTimeout(r, 2200));
      clearInterval(roll);
      const picked = shuffle(entries).slice(0, 1 + MAX_RESERVES);
      const winners: Winner[] = picked.map((e) => ({ uid: e.uid, code: e.code, name: e.name, purok: e.purok }));
      const batch = writeBatch(db);
      batch.set(doc(db, "raffleResult", "current"), { winners, total: entries.length, drawnAt: serverTimestamp(), drawnBy: user.uid, active: 0, log: [] });
      batch.set(doc(db, "rafflePublic", "current"), {
        label: maskName(winners[0].name),
        purok: winners[0].purok,
        code: winners[0].code,
        total: entries.length,
        active: 0,
        reserves: winners.length - 1,
        prize: config?.prize ?? "",
        drawnAt: serverTimestamp(),
      });
      await batch.commit();
      setReel(maskName(winners[0].name));
      logActivity("Raffle", `Natapos ang bunutan: ${entries.length} entries, mananalo: ${maskName(winners[0].name)} (${winners[0].code})`);
      toast("May mapalad na mananalo na! Naitala na ang resulta.");
      refresh();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy("");
    }
  };

  /** The winner did not claim the prize: the next reserve takes over (with the reason in the log). */
  const nextReserve = async () => {
    if (!result || !user) return;
    if (!note.trim()) return toast("Isulat muna ang dahilan.", "error");
    const next = result.active + 1;
    const w = result.winners[next];
    if (!w) return toast("Wala nang reserba.", "error");
    if (!confirm(`Hindi nakuha ng kasalukuyang nanalo ang premyo? Ang susunod ay si ${maskName(w.name)}.`)) return;
    setBusy("next");
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "raffleResult", "current"), { active: next, log: [...(result.log ?? []), { at: new Date().toISOString(), by: user.uid, note: note.trim().slice(0, 200) }] });
      batch.update(doc(db, "rafflePublic", "current"), { active: next, label: maskName(w.name), purok: w.purok, code: w.code });
      await batch.commit();
      logActivity("Raffle", `Lumipat sa reserba #${next}: ${maskName(w.name)} (${note.trim()})`);
      setNote("");
      toast("Lumipat na sa susunod na reserba.");
      refresh();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy("");
    }
  };

  const phaseText = pub ? "Tapos na" : !config?.enabled ? "Sarado (naka-off)" : now < (config.startAt?.toMillis() ?? 0) ? "Hindi pa nagsisimula" : now < cutoffMs ? "Bukas ang entries" : "Sarado na ang entries";

  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-brand-deep p-3 text-sm text-white">
        <b className="text-gold">Developer lang.</b> Ang mga <b>verified na resident</b> ay kusang magkakaroon ng isang entry hanggang sa cutoff. Hindi kasali ang admin at opisyal. Ang bunutan ay gagawin dito, sa araw ng raffle.
      </p>

      <Card className="space-y-3">
        <h2 className="font-extrabold">Setup ng raffle</h2>
        <label className="flex items-center justify-between gap-3 text-sm font-semibold">
          Bukas ang raffle (nakikita ng lahat)
          <button type="button" role="switch" aria-checked={enabled} onClick={() => setEnabled(!enabled)} disabled={!!pub} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${enabled ? "bg-brand" : "bg-gray-300"}`}>
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${enabled ? "left-[1.4rem]" : "left-0.5"}`} />
          </button>
        </label>
        <Input label="Simula (default Dec 28, 2026)" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} disabled={!!pub} />
        <Input label="Cutoff ng entries" type="datetime-local" value={cutoffAt} onChange={(e) => setCutoffAt(e.target.value)} disabled={!!pub} />
        <Input label="Oras ng bunutan (araw ng cutoff)" type="datetime-local" value={drawAt} onChange={(e) => setDrawAt(e.target.value)} disabled={!!pub} />
        <Input label="Premyo" value={prize} onChange={(e) => setPrize(e.target.value)} maxLength={120} placeholder="hal. ₱10,000 + grocery pack" disabled={!!pub} />
        <Button full loading={busy === "save"} disabled={!!pub} onClick={save}>I-save ang setup</Button>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white p-3 text-center shadow-card">
          <b className="block text-2xl tabular-nums">{count ?? "…"}</b>
          <span className="text-xs text-gray-500">Entries</span>
        </div>
        <div className="rounded-2xl bg-white p-3 text-center shadow-card">
          <b className="block text-sm">{phaseText}</b>
          <span className="text-xs text-gray-500">Status</span>
        </div>
      </div>
      <Button variant="outline" full loading={busy === "sync"} disabled={!!pub} onClick={sync}>
        Isama ang lahat ng verified na wala pang entry
      </Button>
      <p className="text-xs text-gray-500">Gamitin ito bago ang cutoff o bago ang bunutan para masama pati ang mga verified na hindi nagbukas ng app.</p>

      <Card className="space-y-3">
        <h2 className="font-extrabold">Bunutan</h2>
        {!pub && !canDraw && (
          <p className="rounded-xl bg-yellow-50 p-2.5 text-sm text-yellow-900">
            Hindi pa pwedeng bumunot. {config?.cutoffAt ? `Hintayin ang cutoff (${formatWhen(config.cutoffAt)}) at ang oras ng bunutan (${formatWhen(config.drawAt)}).` : "I-save muna ang setup."}
          </p>
        )}
        <div className="flex min-h-[5rem] flex-col items-center justify-center rounded-2xl bg-brand-deep px-3 py-5 text-center text-3xl font-black text-gold">
          {reel || (pub ? `🎉 ${pub.label}` : "— — —")}
          <span className="mt-1 text-xs font-semibold text-white/75">{pub ? `Entry ${pub.code} · ${pub.total} ang kasali` : `${count ?? 0} entries ang kasali`}</span>
        </div>
        {!pub && (
          <Button variant="primary" full loading={busy === "draw"} disabled={!canDraw} onClick={draw}>
            <Dices className="h-5 w-5" aria-hidden /> Simulan ang bunutan
          </Button>
        )}
        <p className="text-xs text-gray-500">Isang beses lang ito. Random ang pagpili at kasama ang {MAX_RESERVES} reserba. Naitala ang oras at resulta at hindi na mababago.</p>
      </Card>

      {result && (
        <Card className="space-y-2">
          <h2 className="font-extrabold">Mananalo at mga reserba</h2>
          <ol className="space-y-1.5 text-sm">
            {result.winners.map((w, i) => (
              <li key={w.uid} className={`rounded-xl px-3 py-2 ${i === result.active ? "bg-gold-light font-bold" : i < result.active ? "bg-gray-100 text-gray-500 line-through" : "bg-surface"}`}>
                {i === 0 ? "Mananalo" : `Reserba ${i}`}: {w.name} · {w.purok || "—"} · {w.code}
                {i === result.active && <span className="ml-1 text-xs">(ngayon)</span>}
              </li>
            ))}
          </ol>
          {(result.log ?? []).map((l, i) => (
            <p key={i} className="text-xs text-gray-600">{new Date(l.at).toLocaleString("fil-PH")} · Lumipat sa susunod na reserba: {l.note}</p>
          ))}
          {result.active < result.winners.length - 1 && (
            <>
              <Input label="Dahilan (hal. hindi nakuha ang premyo)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
              <Button variant="danger" full loading={busy === "next"} onClick={nextReserve}>Hindi nakuha → susunod na reserba</Button>
            </>
          )}
          <p className="text-xs text-gray-500">Ang buong pangalan ay nakikita mo lang dito. Sa publiko, ang unang pangalan at inisyal lang.</p>
        </Card>
      )}
    </div>
  );
}
