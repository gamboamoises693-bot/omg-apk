"use client";

import Link from "next/link";
import { Gift, Trophy } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { countdown, formatWhen, phaseOf, raffleReady, roundsOf, useMyEntry, useNow, useRaffle, type PublicRound } from "@/lib/raffle";
import { RaffleSponsors } from "@/components/RaffleSponsors";
import { WinnerQr } from "@/components/WinnerQr";

function Countdown({ target }: { target: number }) {
  const now = useNow();
  const c = countdown(target - now);
  const parts: [number, string][] = [[c.d, "araw"], [c.h, "oras"], [c.m, "minuto"], [c.s, "segundo"]];
  return (
    <div className="grid grid-cols-4 gap-2" role="timer" aria-label="Natitirang oras">
      {parts.map(([n, l]) => (
        <div key={l} className="rounded-xl bg-white/12 py-2 text-center">
          <b className="block text-xl tabular-nums">{String(n).padStart(2, "0")}</b>
          <span className="text-[0.68rem] text-white/75">{l}</span>
        </div>
      ))}
    </div>
  );
}

function RoundResult({ r, myCode, claimed }: { r: PublicRound; myCode?: string; claimed: (round: number, code: string) => boolean }) {
  const major = r.type === "maj";
  return (
    <div className={`rounded-3xl p-4 shadow-card ${major ? "bg-gradient-to-b from-gold-light to-[#EAD27A] text-[#3B2E05]" : "bg-white"}`}>
      <p className="flex items-center gap-1.5 text-xs font-extrabold tracking-wider">
        <Trophy className="h-4 w-4" aria-hidden /> {major ? "MAJOR PRIZE" : r.name.toUpperCase()}
        <span className="ml-auto font-bold opacity-70">Round {r.round}</span>
      </p>
      <ol className="mt-2 space-y-2">
        {r.winners.map((w, i) => {
          const mine = !!myCode && w.code === myCode;
          const got = claimed(r.round, w.code);
          return (
            <li key={i} className={`rounded-2xl px-3 py-2 text-center ${mine ? "ring-2 ring-brand" : ""} ${major ? "bg-white/60" : "bg-surface"}`}>
              <p className={`${major ? "text-2xl" : "text-lg"} font-black`}>🎉 {w.label}{mine ? " (ikaw!)" : ""}</p>
              <p className="text-sm">Entry {w.code} · {w.purok || "Malineng"}</p>
              <p className="text-xs font-bold">Premyo: {w.prize}{got ? " · ✓ Nakuha na" : ""}</p>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-center text-xs opacity-80">{r.total} ang kasali sa round na ito · random na pinili ng app</p>
    </div>
  );
}

/**
 * The raffle for residents: the entry code while entries are open, the countdown to the draw, the winners of each
 * round as soon as it is drawn, and a QR for every prize the person won (an admin scans it to hand over the prize).
 */
export function RaffleCard({ full = false }: { full?: boolean }) {
  const { user, isVerified, isStaff } = useAuth();
  const { config, rounds, claims, loaded } = useRaffle();
  const now = useNow(1000);
  const entry = useMyEntry(user?.uid);
  const phase = phaseOf(config, rounds.length, now);
  const cfgRounds = roundsOf(config);
  const claimed = (round: number, code: string) => !!claims[`${round}_${code}`];

  if (!loaded || phase === "off") {
    return full ? <p className="rounded-2xl bg-white p-4 text-center text-sm text-gray-600 shadow-card">Malapit na ang raffle ng Barangay. Abangan ang anunsyo.</p> : null;
  }
  const major = cfgRounds[cfgRounds.length - 1];
  const myWins = entry ? rounds.flatMap((r) => r.winners.filter((w) => w.code === entry.code).map((w) => ({ r, w }))) : [];
  const nextRound = cfgRounds[rounds.length];

  return (
    <div className="mt-3 space-y-3">
      <div className="space-y-3 rounded-3xl bg-gradient-to-br from-brand to-brand-deep p-4 text-white shadow-float">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-extrabold tracking-wider text-gold"><Gift className="h-4 w-4" aria-hidden /> RAFFLE NG BARANGAY</p>
          {phase === "open" && <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[0.68rem] font-extrabold text-green-800">Bukas ang entries</span>}
          {phase === "closed" && <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[0.68rem] font-extrabold text-red-800">Sarado na</span>}
          {phase === "live" && <span className="rounded-full bg-gold px-2.5 py-0.5 text-[0.68rem] font-extrabold text-brand-deep">Kasalukuyang bunutan</span>}
          {phase === "done" && <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[0.68rem] font-extrabold">Tapos na</span>}
        </div>

        {cfgRounds.length === 1 ? (
          <p className="text-sm text-white/90">
            {cfgRounds[0].prizes.length === 1 ? "Premyo" : `${cfgRounds[0].prizes.length} ang mananalo. Mga premyo`}: <b>{cfgRounds[0].prizes.join(" · ")}</b>
          </p>
        ) : (
          <p className="text-sm text-white/90">
            <b>{cfgRounds.length} na round.</b> Major prize sa huli: <b className="text-gold">{major?.prizes.join(" · ")}</b>
          </p>
        )}

        {phase === "soon" && (
          <>
            <p className="text-lg font-extrabold">Magsisimula sa {formatWhen(config?.startAt)}</p>
            <p className="text-sm text-white/85">Mag-register at mag-verify para magkaroon ng entry.</p>
          </>
        )}

        {phase === "open" && raffleReady(config) && (
          <>
            {!user ? (
              <>
                <p className="text-lg font-extrabold">Sumali sa raffle</p>
                <p className="text-sm text-white/85">Mag-register at mag-verify ng account para magkaroon ng entry.</p>
                <Link href="/login" className="block rounded-xl bg-gold py-2.5 text-center text-sm font-extrabold text-brand-deep">Mag-register o mag-login</Link>
              </>
            ) : isStaff ? (
              <p className="text-sm text-white/85">Hindi kasali sa raffle ang mga admin at opisyal.</p>
            ) : !isVerified ? (
              <>
                <p className="text-lg font-extrabold">Isa pang hakbang</p>
                <p className="text-sm text-white/85">Ma-verify lang ang account mo (selfie at ID) at <b>awtomatiko kang magkakaroon ng entry</b>.</p>
                <Link href="/account" className="block rounded-xl bg-gold py-2.5 text-center text-sm font-extrabold text-brand-deep">Mag-verify ngayon</Link>
              </>
            ) : entry ? (
              <>
                <p className="text-sm text-white/85">Ang entry code mo</p>
                <p className="inline-block rounded-2xl border border-dashed border-gold/70 bg-white/12 px-4 py-2 text-3xl font-black tracking-widest text-gold">{entry.code}</p>
                <p className="text-sm text-white/85">Nakatala ka na. Hindi na kailangang gumawa ng iba pa.</p>
              </>
            ) : (
              <p className="text-sm text-white/85">Inihahanda ang entry mo…</p>
            )}
            <p className="text-xs text-white/75">Cutoff: {formatWhen(config?.cutoffAt)}</p>
            <Countdown target={config.cutoffAt.toMillis()} />
          </>
        )}

        {phase === "closed" && raffleReady(config) && (
          <>
            <p className="text-lg font-extrabold">Sarado na ang entries</p>
            <p className="text-sm text-white/85">
              {entry ? <>Kasali ka sa bunutan. Ang entry code mo ay <b className="text-gold">{entry.code}</b>.</> : "Pasensya na, hindi na makakakuha ng entry dahil tapos na ang cutoff. Maraming salamat sa pag-register."}
            </p>
            <p className="text-xs text-white/75">Bunutan: {formatWhen(config.drawAt)}</p>
            <Countdown target={config.drawAt.toMillis()} />
          </>
        )}

        {phase === "live" && (
          <>
            <p className="text-lg font-extrabold">Round {rounds.length} ng {cfgRounds.length} ang natapos</p>
            <p className="text-sm text-white/85">{nextRound ? <>Susunod: <b>{nextRound.type === "maj" ? "MAJOR PRIZE" : nextRound.name}</b>. Abangan ang bunutan!</> : ""}{entry ? <> Ang entry code mo ay <b className="text-gold">{entry.code}</b>.</> : ""}</p>
          </>
        )}

        {phase === "done" && <p className="text-sm text-white/85">{entry ? (myWins.length ? "" : "Salamat sa pagsali! Hindi napili ang entry mo ngayon.") : "Salamat sa pag-register."}</p>}
      </div>

      {myWins.map(({ r, w }) => (
        <div key={`${r.round}-${w.code}`} className="space-y-2 rounded-3xl bg-gradient-to-b from-gold-light to-[#EAD27A] p-4 text-center text-[#3B2E05] shadow-card">
          <p className="text-lg font-black">🎉 Panalo ka ng {w.prize}!</p>
          <p className="text-xs font-bold">{r.type === "maj" ? "MAJOR PRIZE" : r.name} · Round {r.round}</p>
          {claimed(r.round, w.code) ? (
            <p className="rounded-xl bg-white/70 p-2.5 text-sm font-bold text-green-800">✓ Nakuha mo na ang premyo mo. Hindi na magagamit ang QR na ito.</p>
          ) : (
            <>
              <div className="mx-auto w-fit rounded-2xl bg-white p-2"><WinnerQr round={r.round} code={w.code} /></div>
              <p className="text-sm font-bold">Ipakita ito sa Barangay Hall kasama ang valid ID mo.</p>
              <p className="text-xs">Ina-scan ito ng admin para patunayang ikaw ang nanalo. Huwag ibigay ang QR sa iba.</p>
            </>
          )}
        </div>
      ))}

      {[...rounds].reverse().map((r) => (
        <RoundResult key={r.id} r={r} myCode={entry?.code} claimed={claimed} />
      ))}

      {full && cfgRounds.length > 1 && (
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <h2 className="font-extrabold">Mga round at premyo</h2>
          <ol className="mt-2 space-y-1.5 text-sm">
            {cfgRounds.map((r, i) => (
              <li key={i} className={`flex items-start justify-between gap-2 rounded-xl px-3 py-2 ${r.type === "maj" ? "bg-gold-light font-bold" : "bg-surface"}`}>
                <span>{i + 1}. {r.type === "maj" ? "MAJOR PRIZE" : r.name}</span>
                <span className="text-right text-gray-700">{r.prizes.join(" · ")}{i < rounds.length ? " ✓" : ""}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <RaffleSponsors full={full} />

      {full && (
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <h2 className="font-extrabold">Paano ito gumagana</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-gray-700">
            <li><b>Isang account, isang entry.</b> Kapag na-verify ang account mo, awtomatiko kang magkakaroon ng entry code.</li>
            <li><b>Hanggang cutoff lang.</b> Pagkatapos ng cutoff, walang entry na ibibigay sa mga magre-register.</li>
            <li><b>Bunutan sa app, round by round.</b> Makikita ng lahat ang nanalo sa bawat round pagkabunot. Ang <b>major prize</b> ang huli.</li>
            <li><b>Pagkuha ng premyo:</b> ipakita ang QR ng panalo mo at ang valid ID sa Barangay Hall.</li>
            <li><b>Hindi kasali</b> ang mga admin at opisyal ng Barangay.</li>
          </ul>
        </section>
      )}
    </div>
  );
}
