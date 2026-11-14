"use client";

import Link from "next/link";
import { Gift, Trophy } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { countdown, formatWhen, phaseOf, prizeList, raffleReady, useMyEntry, useNow, useRaffle } from "@/lib/raffle";
import { RaffleSponsors } from "@/components/RaffleSponsors";

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

/**
 * The raffle for residents: shows the person's entry code while entries are open, the closed state after the cutoff,
 * and the winner after the draw. Verified residents get their entry automatically (once, before the cutoff).
 */
export function RaffleCard({ full = false }: { full?: boolean }) {
  const { user, profile, isVerified, isStaff } = useAuth();
  const { config, pub, loaded } = useRaffle();
  const now = useNow(1000);
  const entry = useMyEntry(user?.uid);
  const phase = phaseOf(config, pub, now);

  if (!loaded || phase === "off") {
    return full ? <p className="rounded-2xl bg-white p-4 text-center text-sm text-gray-600 shadow-card">Malapit na ang raffle ng Barangay. Abangan ang anunsyo.</p> : null;
  }
  const prizes = prizeList(config);
  const myWin = pub && entry ? pub.winners.find((w) => w.code === entry.code) : undefined;
  const iWon = !!myWin;

  return (
    <div className="mt-3 space-y-3">
      <div className="space-y-3 rounded-3xl bg-gradient-to-br from-brand to-brand-deep p-4 text-white shadow-float">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-extrabold tracking-wider text-gold"><Gift className="h-4 w-4" aria-hidden /> RAFFLE NG BARANGAY</p>
          {phase === "open" && <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[0.68rem] font-extrabold text-green-800">Bukas ang entries</span>}
          {phase === "closed" && <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[0.68rem] font-extrabold text-red-800">Sarado na</span>}
          {phase === "done" && <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[0.68rem] font-extrabold">Tapos na</span>}
        </div>
        {prizes.length === 1 && <p className="text-sm text-white/90">Premyo: <b>{prizes[0]}</b></p>}
        {prizes.length > 1 && (
          <div className="text-sm text-white/90">
            <p>{prizes.length} ang mananalo. Mga premyo:</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5">
              {prizes.map((p, i) => (
                <li key={i}><b>{p}</b></li>
              ))}
            </ol>
          </div>
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

        {phase === "done" && pub && (
          <p className="text-sm text-white/85">{entry ? (iWon ? "" : "Salamat sa pagsali! Hindi napili ang entry mo ngayon.") : "Salamat sa pag-register."}</p>
        )}
      </div>

      {phase === "done" && pub && (
        <div className="rounded-3xl bg-gradient-to-b from-gold-light to-[#EAD27A] p-5 text-[#3B2E05] shadow-card">
          <p className="flex items-center justify-center gap-1.5 text-xs font-extrabold tracking-wider"><Trophy className="h-4 w-4" aria-hidden /> {pub.winners.length > 1 ? "MGA MAPALAD NA MANANALO" : "MAPALAD NA MANANALO"}</p>
          {iWon && <p className="mt-2 rounded-xl bg-white/70 p-2 text-center text-sm font-bold">Panalo ka ng {myWin?.prize}! Makipag-ugnayan sa Barangay Hall para makuha ang premyo.</p>}
          <ol className="mt-3 space-y-2">
            {pub.winners.map((w, i) => (
              <li key={i} className="rounded-2xl bg-white/60 px-3 py-2 text-center">
                <p className="text-xl font-black">🎉 {w.label}</p>
                <p className="text-sm">Entry {w.code} · {w.purok || "Malineng"}</p>
                {w.prize && <p className="text-xs font-bold">Premyo: {w.prize}</p>}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-center text-xs">{pub.total} na verified na account ang sumali. Random na pinili ng app.</p>
        </div>
      )}

      <RaffleSponsors full={full} />

      {full && (
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <h2 className="font-extrabold">Paano ito gumagana</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-gray-700">
            <li><b>Isang account, isang entry.</b> Kapag na-verify ang account mo, awtomatiko kang magkakaroon ng entry code.</li>
            <li><b>Hanggang cutoff lang.</b> Pagkatapos ng cutoff, walang entry na ibibigay sa mga magre-register.</li>
            <li><b>Bunutan sa app.</b> Isang mapalad na mananalo ang pipiliin nang random ng app, at makikita ito ng lahat.</li>
            <li><b>Hindi kasali</b> ang mga admin at opisyal ng Barangay.</li>
          </ul>
        </section>
      )}
    </div>
  );
}
