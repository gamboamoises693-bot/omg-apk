"use client";

import { useEffect, useMemo, useState } from "react";
import { Timestamp, collection, doc, getCountFromServer, getDoc, getDocs, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { Dices, Plus, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { logActivity } from "@/lib/activity";
import { friendlyError } from "@/lib/format";
import { verifiedSetRef } from "@/lib/verified";
import {
  DEFAULT_RESERVES,
  DEFAULT_START_ISO,
  MAX_RESERVES,
  MAX_ROUNDS,
  MAX_WINNERS,
  formatWhen,
  maskName,
  newCode,
  roundsOf,
  useNow,
  useRaffle,
  type RaffleEntry,
  type RaffleRoundCfg,
} from "@/lib/raffle";
import { Button, Card, Input, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";

interface Person {
  uid: string;
  code: string;
  name: string;
  purok: string;
}
interface Winner extends Person {
  prize: string;
}
interface RoundDoc {
  round: number;
  winners: Winner[];
  winnerCodes: string[];
  reserves: Person[];
  total: number;
  cursor: number;
  log?: { at: string; by: string; note: string }[];
}

/** datetime-local value (in the device's time zone) from a Timestamp, or a fallback. */
function toInput(ts?: Timestamp, fallbackIso?: string): string {
  const d = ts ? ts.toDate() : fallbackIso ? new Date(fallbackIso) : null;
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Fair shuffle with crypto randomness (Fisher-Yates, no modulo bias). */
function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  const buf = new Uint32Array(1);
  for (let i = a.length - 1; i > 0; i--) {
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

const blankRounds = (): RaffleRoundCfg[] => [{ name: "MAJOR PRIZE", type: "maj", prizes: [""] }];

/** Developer: set up the rounds, add missing verified people, draw round by round, replace a winner who does not claim. */
export function AdminRaffle() {
  const { user } = useAuth();
  const toast = useToast();
  const { config, rounds: publicRounds, claims, loaded } = useRaffle();
  const now = useNow(1000);
  const [startAt, setStartAt] = useState(toInput(undefined, DEFAULT_START_ISO));
  const [cutoffAt, setCutoffAt] = useState("");
  const [drawAt, setDrawAt] = useState("");
  const [rounds, setRounds] = useState<RaffleRoundCfg[]>(blankRounds());
  const [onePer, setOnePer] = useState(true);
  const [reserves, setReserves] = useState(DEFAULT_RESERVES);
  const [loadedForm, setLoadedForm] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState("");
  const [docs, setDocs] = useState<RoundDoc[]>([]);
  const [reel, setReel] = useState("");
  const [note, setNote] = useState("");
  const [slot, setSlot] = useState<{ round: number; i: number } | null>(null);

  // Fill the form once from what is saved.
  useEffect(() => {
    if (!loaded || loadedForm) return;
    setStartAt(toInput(config?.startAt, DEFAULT_START_ISO));
    setCutoffAt(toInput(config?.cutoffAt));
    setDrawAt(toInput(config?.drawAt));
    const saved = roundsOf(config);
    setRounds(saved.length ? saved : blankRounds());
    setOnePer(config?.onePerPerson !== false);
    setReserves(Math.min(MAX_RESERVES, Math.max(0, config?.reservesPerRound ?? DEFAULT_RESERVES)));
    setLoadedForm(true);
  }, [loaded, loadedForm, config]);

  const refresh = async () => {
    try {
      setCount((await getCountFromServer(collection(db, "raffleEntries"))).data().count);
      const snap = await getDocs(collection(db, "raffleRounds"));
      setDocs(snap.docs.map((d) => d.data() as RoundDoc).sort((a, b) => a.round - b.round));
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicRounds.length, publicRounds.map((r) => r.reservesLeft).join(",")]);

  const savedRounds = useMemo(() => roundsOf(config), [config]);
  if (!loaded) return <Spinner />;

  const drawn = publicRounds.length;
  const done = savedRounds.length > 0 && drawn >= savedRounds.length;
  const cutoffMs = config?.cutoffAt?.toMillis() ?? Infinity;
  const drawMs = config?.drawAt?.toMillis() ?? Infinity;
  const next = savedRounds[drawn];
  const canDraw = !!config?.enabled && !!next && now >= cutoffMs && now >= drawMs;
  const cleaned = rounds.map((r) => ({ ...r, prizes: r.prizes.map((p) => p.trim()).filter(Boolean) })).filter((r) => r.prizes.length > 0);
  const locked = drawn > 0;

  const patchRound = (i: number, patch: Partial<RaffleRoundCfg>) => setRounds((list) => list.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const save = async () => {
    if (!startAt || !cutoffAt || !drawAt) return toast("Ilagay ang simula, cutoff at oras ng bunutan.", "error");
    if (cleaned.length === 0) return toast("Maglagay ng kahit isang premyo.", "error");
    const s = new Date(startAt).getTime();
    const c = new Date(cutoffAt).getTime();
    const d = new Date(drawAt).getTime();
    if (!(s < c)) return toast("Dapat mas maaga ang simula kaysa sa cutoff.", "error");
    if (!(c <= d)) return toast("Ang bunutan ay dapat pagkatapos o kasabay ng cutoff.", "error");
    if (locked) return toast("Nasimulan na ang bunutan. Hindi na mababago ang setup.", "error");
    setBusy("save");
    try {
      // merge: the on/off switch above is saved on its own and must not be overwritten here.
      await setDoc(doc(db, "settings", "raffle"), {
        startAt: Timestamp.fromMillis(s),
        cutoffAt: Timestamp.fromMillis(c),
        drawAt: Timestamp.fromMillis(d),
        rounds: cleaned.slice(0, MAX_ROUNDS).map((r, i, all) => ({
          name: (i === all.length - 1 ? "MAJOR PRIZE" : r.name.trim() || `Raffle ${i + 1}`).slice(0, 60),
          type: i === all.length - 1 ? "maj" : "min",
          prizes: r.prizes.slice(0, MAX_WINNERS).map((p) => p.slice(0, 120)),
        })),
        onePerPerson: onePer,
        reservesPerRound: reserves,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      logActivity("Raffle", `Na-save ang setup ng raffle (${cleaned.length} round)`);
      toast("Na-save ang setup ng raffle.");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy("");
    }
  };

  /** Shows or hides the raffle for everyone. Works at any time, also after the draw; nothing is deleted. */
  const setVisible = async (next: boolean) => {
    setBusy("visible");
    try {
      await setDoc(doc(db, "settings", "raffle"), { enabled: next, updatedAt: serverTimestamp() }, { merge: true });
      logActivity("Raffle", next ? "Ipinakita ang raffle sa lahat" : "Itinago ang raffle");
      toast(next ? "Nakikita na ng lahat ang raffle." : "Nakatago na ang raffle.");
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

  /** Draws the next round from the entries that have not won or been drawn as a reserve yet. */
  const draw = async () => {
    if (!user || !next) return;
    const n = next.prizes.length;
    if (!confirm(`Bunutin ang ${next.type === "maj" ? "MAJOR PRIZE" : next.name} (${n} mananalo)? Isang beses lang ito at hindi na mababago ang resulta.`)) return;
    setBusy("draw");
    try {
      const snap = await getDocs(collection(db, "raffleEntries"));
      let entries = snap.docs.map((d) => d.data() as RaffleEntry);
      // Earlier winners and reserves are out of the later rounds (one win per person).
      if (config?.onePerPerson !== false) {
        const out = new Set(docs.flatMap((d) => [...d.winners.map((w) => w.code), ...d.reserves.map((r) => r.code)]));
        entries = entries.filter((e) => !out.has(e.code));
      }
      if (entries.length < n) throw new Error(`Kulang ang entries (${entries.length}) para sa ${n} mananalo.`);
      const names = entries.map((e) => maskName(e.name));
      const roll = setInterval(() => setReel(names[Math.floor(Math.random() * names.length)]), 70);
      await new Promise((r) => setTimeout(r, 2200));
      clearInterval(roll);
      const picked = shuffle(entries);
      const person = (e: RaffleEntry): Person => ({ uid: e.uid, code: e.code, name: e.name, purok: e.purok });
      const winners: Winner[] = picked.slice(0, n).map((e, i) => ({ ...person(e), prize: next.prizes[i] }));
      const reserveList: Person[] = picked.slice(n, n + Math.min(MAX_RESERVES, Math.max(0, config?.reservesPerRound ?? DEFAULT_RESERVES))).map(person);
      const roundNo = drawn + 1;
      const batch = writeBatch(db);
      batch.set(doc(db, "raffleRounds", String(roundNo)), {
        round: roundNo,
        winners,
        winnerCodes: winners.map((w) => w.code),
        reserves: reserveList,
        total: entries.length,
        drawnAt: serverTimestamp(),
        drawnBy: user.uid,
        cursor: 0,
        log: [],
      });
      batch.set(doc(db, "rafflePublicRounds", String(roundNo)), {
        round: roundNo,
        name: next.name,
        type: next.type,
        winners: winners.map((w) => ({ label: maskName(w.name), purok: w.purok, code: w.code, prize: w.prize })),
        total: entries.length,
        reservesLeft: reserveList.length,
        drawnAt: serverTimestamp(),
      });
      await batch.commit();
      setReel(winners.map((w) => maskName(w.name)).join(" · "));
      logActivity("Raffle", `Natapos ang bunutan ng round ${roundNo}: ${winners.length} mananalo, ${reserveList.length} reserba (${entries.length} entries)`);
      toast(`Tapos na ang round ${roundNo}! Makikita na ito ng lahat.`);
      refresh();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy("");
    }
  };

  /** A winner did not claim: the next reserve of that round takes the prize (reason in the log). */
  const replace = async () => {
    if (!slot || !user) return;
    const rd = docs.find((d) => d.round === slot.round);
    const pub = publicRounds.find((r) => r.round === slot.round);
    if (!rd || !pub) return;
    if (!note.trim()) return toast("Isulat muna ang dahilan.", "error");
    const nextReserve = rd.reserves[rd.cursor];
    if (!nextReserve) return toast("Wala nang reserba sa round na ito.", "error");
    const old = rd.winners[slot.i];
    if (!confirm(`Hindi nakuha ni ${maskName(old.name)} ang premyo? Papalitan siya ni ${maskName(nextReserve.name)}.`)) return;
    setBusy("next");
    try {
      const winners = rd.winners.map((w, i) => (i === slot.i ? { ...nextReserve, prize: w.prize } : w));
      const batch = writeBatch(db);
      batch.update(doc(db, "raffleRounds", String(rd.round)), {
        winners,
        winnerCodes: winners.map((w) => w.code),
        cursor: rd.cursor + 1,
        log: [...(rd.log ?? []), { at: new Date().toISOString(), by: user.uid, note: `${maskName(old.name)} → ${maskName(nextReserve.name)}: ${note.trim().slice(0, 160)}` }],
      });
      batch.update(doc(db, "rafflePublicRounds", String(rd.round)), {
        winners: winners.map((w) => ({ label: maskName(w.name), purok: w.purok, code: w.code, prize: w.prize })),
        reservesLeft: pub.reservesLeft - 1,
      });
      await batch.commit();
      logActivity("Raffle", `Round ${rd.round}: napalitan ang mananalo ${maskName(old.name)} → ${maskName(nextReserve.name)} (${note.trim()})`);
      setNote("");
      setSlot(null);
      toast("Napalitan na ng reserba.");
      refresh();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy("");
    }
  };

  /** For tests only: clears the entries, all rounds, claims and the old single-draw documents. */
  const reset = async () => {
    const typed = prompt('PANGTEST LANG. Buburahin ang LAHAT ng entries, resulta at claims ng raffle. I-type ang RESET para ituloy.');
    if (typed?.trim().toUpperCase() !== "RESET") return;
    setBusy("reset");
    try {
      let total = 0;
      for (const name of ["raffleEntries", "raffleRounds", "rafflePublicRounds", "raffleClaims", "rafflePublic", "raffleResult"]) {
        const snap = await getDocs(collection(db, name));
        for (let i = 0; i < snap.docs.length; i += 400) {
          const batch = writeBatch(db);
          snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
          await batch.commit();
          total += Math.min(400, snap.docs.length - i);
        }
      }
      logActivity("Raffle", `Na-reset ang raffle (${total} dokumento ang binura)`);
      toast("Na-reset na ang raffle.");
      setReel("");
      refresh();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy("");
    }
  };

  const phaseText = done ? "Tapos na" : drawn > 0 ? `Round ${drawn} ng ${savedRounds.length}` : !config?.enabled ? "Sarado (naka-off)" : now < (config.startAt?.toMillis() ?? 0) ? "Hindi pa nagsisimula" : now < cutoffMs ? "Bukas ang entries" : "Sarado na ang entries";

  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-brand-deep p-3 text-sm text-white">
        <b className="text-gold">Developer lang.</b> Ang mga <b>verified na resident</b> ay kusang magkakaroon ng isang entry hanggang sa cutoff. Hindi kasali ang admin at opisyal. Hatiin ang raffle sa mga <b>round</b>: minor muna, at ang <b>major prize</b> ang huli. Ang bilang ng premyo sa round ang bilang ng mananalo.
      </p>

      <Card className="space-y-2">
        <label className="flex items-center justify-between gap-3 font-bold">
          Ipakita ang raffle sa lahat
          <button type="button" role="switch" aria-checked={!!config?.enabled} aria-label="Ipakita ang raffle sa lahat" disabled={busy === "visible"} onClick={() => setVisible(!config?.enabled)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${config?.enabled ? "bg-brand" : "bg-gray-300"}`}>
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${config?.enabled ? "left-[1.4rem]" : "left-0.5"}`} />
          </button>
        </label>
        <p className="text-xs text-gray-600">
          Para sa espesyal na event lang. <b>I-off</b> para itago ang raffle sa Home at sa pahinang Raffle (walang entry na ibibigay, at hindi mabubunot). Hindi nabubura ang mga entry at resulta, at pwede itong gamitin <b>kahit pagkatapos ng bunutan</b>. <b>I-on</b> para ipakita ulit. Ang raffle ay lalabas lang kapag naka-on at kumpleto ang petsa at mga premyo.
        </p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-extrabold">Setup ng raffle</h2>
        <Input label="Simula (default Dec 28, 2026)" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} disabled={locked} />
        <Input label="Cutoff ng entries" type="datetime-local" value={cutoffAt} onChange={(e) => setCutoffAt(e.target.value)} disabled={locked} />
        <Input label="Oras ng bunutan (araw ng cutoff)" type="datetime-local" value={drawAt} onChange={(e) => setDrawAt(e.target.value)} disabled={locked} />

        <label className="flex items-center justify-between gap-3 text-sm font-semibold">
          Isang panalo lang bawat tao
          <button type="button" role="switch" aria-checked={onePer} onClick={() => setOnePer(!onePer)} disabled={locked} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${onePer ? "bg-brand" : "bg-gray-300"}`}>
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${onePer ? "left-[1.4rem]" : "left-0.5"}`} />
          </button>
        </label>
        <label className="flex items-center justify-between gap-3 text-sm font-semibold">
          Reserba bawat round
          <select value={reserves} onChange={(e) => setReserves(Number(e.target.value))} disabled={locked} className="w-24 rounded-xl border border-gray-200 bg-white px-3 py-2">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>

        <p className="text-[0.8rem] font-bold text-brand-dark">Mga round ({rounds.length}) · ang huli ay ang MAJOR PRIZE</p>
        {rounds.map((r, i) => {
          const isLast = i === rounds.length - 1;
          return (
            <div key={i} className={`space-y-2 rounded-2xl p-3 ring-1 ${isLast ? "bg-gold-light ring-gold" : "bg-surface ring-gray-200"}`}>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-extrabold text-brand-deep">{i + 1}</span>
                {isLast ? (
                  <b className="flex-1">MAJOR PRIZE</b>
                ) : (
                  <input value={r.name} onChange={(e) => patchRound(i, { name: e.target.value })} maxLength={60} disabled={locked} aria-label={`Pangalan ng round ${i + 1}`} placeholder={`Raffle ${i + 1}`} className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2" />
                )}
                {!isLast && rounds.length > 1 && !locked && (
                  <button type="button" aria-label="Alisin ang round" onClick={() => setRounds((list) => list.filter((_, k) => k !== i))} className="rounded-xl border border-gray-200 bg-white p-2 text-red-700">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {r.prizes.map((p, k) => (
                <div key={k} className="flex items-center gap-2 pl-10">
                  <input
                    value={p}
                    onChange={(e) => patchRound(i, { prizes: r.prizes.map((x, m) => (m === k ? e.target.value : x)) })}
                    maxLength={120}
                    disabled={locked}
                    aria-label={`Premyo ${k + 1} ng round ${i + 1}`}
                    placeholder={isLast ? "hal. ₱10,000 + grocery pack" : "hal. Bigas 5 kilo"}
                    className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2"
                  />
                  {r.prizes.length > 1 && !locked && (
                    <button type="button" aria-label="Alisin ang premyo" onClick={() => patchRound(i, { prizes: r.prizes.filter((_, m) => m !== k) })} className="rounded-xl border border-gray-200 bg-white p-2 text-red-700">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {r.prizes.length < MAX_WINNERS && !locked && (
                <button type="button" onClick={() => patchRound(i, { prizes: [...r.prizes, ""] })} className="pl-10 text-xs font-bold text-brand underline">+ Dagdag na mananalo sa round na ito</button>
              )}
            </div>
          );
        })}
        {rounds.length < MAX_ROUNDS && !locked && (
          <Button
            variant="outline"
            full
            onClick={() => setRounds((list) => [...list.slice(0, -1), { name: `Raffle ${list.length}`, type: "min", prizes: [""] }, list[list.length - 1]])}
          >
            <Plus className="h-4 w-4" aria-hidden /> Dagdagan ng round (bago ang major)
          </Button>
        )}
        {locked && <p className="rounded-xl bg-yellow-50 p-2.5 text-xs text-yellow-900">Nasimulan na ang bunutan, kaya hindi na mababago ang setup.</p>}
        <Button full loading={busy === "save"} disabled={locked} onClick={save}>I-save ang setup</Button>
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
      <Button variant="outline" full loading={busy === "sync"} disabled={locked} onClick={sync}>
        Isama ang lahat ng verified na wala pang entry
      </Button>
      <p className="text-xs text-gray-500">Gamitin ito bago ang cutoff o bago ang bunutan para masama pati ang mga verified na hindi nagbukas ng app.</p>

      <Card className="space-y-3">
        <h2 className="font-extrabold">Bunutan</h2>
        {!done && !canDraw && (
          <p className="rounded-xl bg-yellow-50 p-2.5 text-sm text-yellow-900">
            Hindi pa pwedeng bumunot. {config?.cutoffAt ? `Hintayin ang cutoff (${formatWhen(config.cutoffAt)}) at ang oras ng bunutan (${formatWhen(config.drawAt)}), at siguraduhing naka-on at naka-save ang setup.` : "I-save muna ang setup."}
          </p>
        )}
        <div className="flex min-h-[5rem] flex-col items-center justify-center rounded-2xl bg-brand-deep px-3 py-5 text-center text-2xl font-black text-gold">
          {reel || (done ? "🎉 Tapos na ang lahat ng round" : "— — —")}
          <span className="mt-1 text-xs font-semibold text-white/75">{next ? `Susunod: ${next.type === "maj" ? "MAJOR PRIZE" : next.name} · ${next.prizes.length} mananalo` : `${count ?? 0} entries`}</span>
        </div>
        {next && (
          <Button variant="primary" full loading={busy === "draw"} disabled={!canDraw} onClick={draw}>
            <Dices className="h-5 w-5" aria-hidden /> Bunutin ang {next.type === "maj" ? "MAJOR PRIZE" : next.name}
          </Button>
        )}
        <p className="text-xs text-gray-500">Isa-isang bubunutin ang bawat round. Random ang pagpili at makikita agad ng lahat ang nanalo. Naitala ang oras at resulta at hindi na mababago.</p>
      </Card>

      {docs.map((rd) => {
        const pub = publicRounds.find((r) => r.round === rd.round);
        const cfg = savedRounds[rd.round - 1];
        return (
          <Card key={rd.round} className="space-y-2">
            <h2 className="font-extrabold">Round {rd.round}: {cfg?.type === "maj" ? "MAJOR PRIZE" : cfg?.name}</h2>
            <ol className="space-y-1.5 text-sm">
              {rd.winners.map((w, i) => {
                const got = claims[`${rd.round}_${w.code}`];
                return (
                  <li key={`${w.uid}-${i}`} className="rounded-xl bg-gold-light px-3 py-2">
                    <b>{w.prize}</b>
                    <span className="block">{w.name} · {w.purok || "—"} · {w.code}</span>
                    {got ? (
                      <span className="text-xs font-bold text-green-800">✓ Nakuha na ({got.claimedByName})</span>
                    ) : (
                      rd.cursor < rd.reserves.length && (
                        <button type="button" onClick={() => setSlot(slot?.round === rd.round && slot.i === i ? null : { round: rd.round, i })} className="mt-1 text-xs font-bold text-red-700 underline">
                          {slot?.round === rd.round && slot.i === i ? "Huwag nang palitan" : "Hindi nakuha ang premyo"}
                        </button>
                      )
                    )}
                  </li>
                );
              })}
            </ol>
            {slot?.round === rd.round && (
              <div className="space-y-2 rounded-xl bg-red-50 p-3">
                <p className="text-sm">Papalitan ng susunod na reserba: <b>{rd.reserves[rd.cursor] ? maskName(rd.reserves[rd.cursor].name) : "—"}</b></p>
                <Input label="Dahilan (hal. hindi nakuha ang premyo)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={160} />
                <Button variant="danger" full loading={busy === "next"} onClick={replace}>Palitan ng reserba</Button>
              </div>
            )}
            <p className="text-xs text-gray-600">Reserba ({rd.reserves.length - rd.cursor} natitira): {rd.reserves.map((r, i) => (i < rd.cursor ? `~~${maskName(r.name)}~~` : `${r.name} (${r.code})`)).join(", ") || "wala"}</p>
            {(rd.log ?? []).map((l, i) => (
              <p key={i} className="text-xs text-gray-600">{new Date(l.at).toLocaleString("fil-PH")} · {l.note}</p>
            ))}
            {pub && <p className="text-xs text-gray-500">{pub.total} ang kasali sa round na ito.</p>}
          </Card>
        );
      })}

      <Button variant="outline" full className="!text-red-700" loading={busy === "reset"} onClick={reset}>I-reset ang raffle (pangtest lang)</Button>
    </div>
  );
}
