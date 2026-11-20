"use client";

import type { ReactNode } from "react";
import { Card, Spinner } from "@/components/ui";
import { formatPeso } from "@/lib/format";
import { RAG_RULES, RAG_WORD, type AttentionItem, type AyudaData, type HealthData, type ProjectData, type Rag, type Scorecard, type ScoreItem } from "@/lib/executive";
import { PROJECT_STATUS_LABEL } from "@/lib/constants";

export type ExecTab = "buod" | "kalusugan" | "proyekto" | "ayuda" | "transaksyon";

const RAG_CLASS: Record<Rag, string> = {
  g: "bg-emerald-50 text-emerald-700",
  y: "bg-yellow-50 text-yellow-900",
  r: "bg-red-50 text-red-700",
  n: "bg-[#EDF0F5] text-gray-600",
};
const RAG_DOT: Record<Rag, string> = { g: "bg-emerald-600", y: "bg-amber-600", r: "bg-red-700", n: "bg-gray-400" };
/** Gauge ring colours (light, to read on the navy card). */
const RAG_RING: Record<Rag, string> = { g: "#34d399", y: "#fbbf24", r: "#f87171", n: "#9ca3af" };

/** Status chip: always a word and a dot, never colour alone. */
export function RagChip({ rag, label }: { rag: Rag; label?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.62rem] font-extrabold uppercase ${RAG_CLASS[rag]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${RAG_DOT[rag]}`} aria-hidden />
      {label ?? RAG_WORD[rag]}
    </span>
  );
}

/** Light tile (inside white cards). */
function Stat({ value, label, tone = "text-brand-deep", bg = "bg-surface" }: { value: ReactNode; label: string; tone?: string; bg?: string }) {
  return (
    <div className={`flex flex-col gap-0.5 rounded-2xl p-3 ${bg}`}>
      <b className={`text-[1.5rem] font-extrabold leading-tight tabular-nums ${tone}`}>{value}</b>
      <span className="text-[0.74rem] font-bold text-gray-600">{label}</span>
    </div>
  );
}

/** Tile on a navy hero card; `tone` tints it when something needs attention. */
function HeroStat({ value, label, tone }: { value: ReactNode; label: string; tone?: "warn" | "bad" }) {
  const bg = tone === "bad" ? "bg-red-400/30" : tone === "warn" ? "bg-amber-300/25" : "bg-white/10";
  return (
    <div className={`rounded-2xl p-3 ${bg}`}>
      <b className="block text-[1.5rem] font-extrabold leading-tight tabular-nums">{value}</b>
      <span className="text-[0.7rem] font-bold text-blue-100">{label}</span>
    </div>
  );
}

/** Navy executive card: title, status chip and a row of tiles, then optional extra content. */
function Hero({ title, rag, ragLabel, children }: { title: string; rag?: Rag; ragLabel?: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.125rem] bg-gradient-to-b from-brand-dark to-[#0A1B3C] p-4 text-white shadow-[0_10px_22px_-12px_rgba(10,27,60,0.7)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[1.05rem] font-bold">{title}</h2>
        {rag && <RagChip rag={rag} label={ragLabel} />}
      </div>
      {children}
    </section>
  );
}

function Cap({ children, light }: { children: ReactNode; light?: boolean }) {
  return <p className={`text-[0.72rem] font-extrabold uppercase tracking-[0.08em] ${light ? "text-blue-100" : "text-gray-600"}`}>{children}</p>;
}

function Track({ pct, color = "bg-brand", dark }: { pct: number; color?: string; dark?: boolean }) {
  return (
    <span className={`block h-3 overflow-hidden rounded-full ${dark ? "bg-white/15" : "bg-[#EDF0F5]"}`} aria-hidden>
      <span className={`block h-3 rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </span>
  );
}

function Row({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-2 border-t border-line text-[0.9rem] first:border-t-0">
      <span className="min-w-0">{children}</span>
      {right}
    </div>
  );
}

const Loading = () => <Spinner label="Kinukuha ang datos..." />;
const NoData = ({ children, light }: { children: ReactNode; light?: boolean }) => <p className={`py-3 text-sm ${light ? "text-blue-100" : "text-gray-600"}`}>{children}</p>;

/* ---------------- Gauge card (Buod) ---------------- */

function GaugeCard({ item }: { item: ScoreItem }) {
  const circ = 2 * Math.PI * 42;
  const fill = Math.max(0, Math.min(1, item.fill));
  return (
    <div className="flex flex-col items-center gap-1 rounded-[1.125rem] bg-gradient-to-b from-brand-dark to-[#0A1B3C] px-2.5 pb-3 pt-3.5 text-center text-white shadow-[0_10px_22px_-12px_rgba(10,27,60,0.7)]">
      <span className="text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-blue-100">{item.label}</span>
      <span className="relative my-1 h-[5.4rem] w-[5.4rem]">
        <svg viewBox="0 0 100 100" className="absolute inset-0" aria-hidden>
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="9" />
          <circle cx="50" cy="50" r="42" fill="none" stroke={RAG_RING[item.rag]} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${circ * fill} ${circ}`} transform="rotate(-90 50 50)" />
        </svg>
        <b className="absolute inset-0 flex items-center justify-center text-[1.2rem] font-extrabold tabular-nums">{item.value}</b>
      </span>
      <span className="min-h-8 text-[0.72rem] leading-4 text-blue-100">{item.note}</span>
      <RagChip rag={item.rag} />
    </div>
  );
}

/* ---------------- Buod ---------------- */

export function BuodTab({ card, loading, summaryLine, onGo, residents }: { card: Scorecard | null; loading: boolean; summaryLine: ReactNode; onGo: (tab: ExecTab) => void; residents: AyudaData["residents"] | null }) {
  if (loading || !card) return <Loading />;
  const urgent = card.attention.filter((a) => a.tone === "r").length;
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-b from-white to-[#F4F8FE]">
        <Cap>Buod</Cap>
        <p className="mt-1 text-[0.98rem] leading-6">
          {summaryLine}
          {urgent > 0 ? <> May <b className="text-red-700">{urgent} bagay na kailangan ng iyong pansin.</b></> : <> Walang kritikal na bagay ngayon.</>}
        </p>
      </Card>

      <div>
        <Cap>Scorecard ng barangay</Cap>
        <div className="mt-2 grid grid-cols-2 gap-2.5">
          {card.items.map((it) => <GaugeCard key={it.key} item={it} />)}
        </div>
        <details className="mt-2 text-xs text-gray-600">
          <summary className="min-h-8 cursor-pointer font-bold text-brand">Paano binibilang ang kulay?</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{RAG_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
        </details>
      </div>

      <Card className="!pb-2">
        <h2 className="text-[1.05rem] font-bold">Dapat bigyang-pansin</h2>
        {card.attention.length === 0 ? (
          <NoData>Walang kailangang bigyang-pansin. Maayos ang lahat.</NoData>
        ) : (
          <ul className="mt-1">{card.attention.map((a) => <AttentionRow key={a.key} item={a} onGo={onGo} />)}</ul>
        )}
      </Card>

      {residents && (
        <Card className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-[1.5rem] font-extrabold text-brand-deep tabular-nums">{residents.total}</div><div className="text-[0.72rem] font-bold text-gray-600">Account ng residente</div></div>
          <div><div className="text-[1.5rem] font-extrabold text-brand-deep tabular-nums">{residents.households}</div><div className="text-[0.72rem] font-bold text-gray-600">Household</div></div>
          <div><div className="text-[1.5rem] font-extrabold text-brand-deep tabular-nums">{residents.total ? Math.round((residents.verified / residents.total) * 100) : 0}%</div><div className="text-[0.72rem] font-bold text-gray-600">Verified</div></div>
        </Card>
      )}
    </div>
  );
}

function AttentionRow({ item, onGo }: { item: AttentionItem; onGo: (tab: ExecTab) => void }) {
  return (
    <li className="border-t border-line first:border-t-0">
      <button onClick={() => onGo(item.tab)} className="flex w-full items-start gap-3 py-3 text-left">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.tone === "r" ? "bg-red-700" : "bg-amber-600"}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <b className="block text-[0.92rem]">{item.title}</b>
          {item.detail && <span className="block truncate text-[0.78rem] text-gray-600">{item.detail}</span>}
        </span>
        <span className="mt-0.5 text-xs font-bold text-brand">Buksan</span>
      </button>
    </li>
  );
}

/* ---------------- Kalusugan at emergency ---------------- */

export function KalusuganTab({ data, loading, rag }: { data: HealthData | null; loading: boolean; rag: { emergency: Rag; botika: Rag } }) {
  if (loading || !data) return <Loading />;
  const a = data.ambulance;
  const maxType = Math.max(1, a.emergency, a.scheduled);
  return (
    <div className="space-y-4">
      <Hero title="Ambulansya at emergency" rag={rag.emergency}>
        <div className="grid grid-cols-3 gap-2">
          <HeroStat value={a.trips} label="Biyahe sa panahong ito" />
          <HeroStat value={a.avgRespMin === null ? "—" : `${a.avgRespMin} min`} label="Karaniwang sagot" />
          <HeroStat value={a.waiting} label="Naghihintay" tone={a.waiting ? "bad" : undefined} />
        </div>
        <div className="mt-4 space-y-1.5">
          <Cap light>Uri ng biyahe</Cap>
          <div className="grid grid-cols-[7rem_minmax(0,1fr)_2rem] items-center gap-2 text-[0.85rem]"><span>Emergency</span><Track dark pct={(a.emergency / maxType) * 100} color="bg-red-400" /><b className="text-right">{a.emergency}</b></div>
          <div className="grid grid-cols-[7rem_minmax(0,1fr)_2rem] items-center gap-2 text-[0.85rem]"><span>Naka-schedule</span><Track dark pct={(a.scheduled / maxType) * 100} color="bg-blue-300" /><b className="text-right">{a.scheduled}</b></div>
        </div>
        {a.reasons.length > 0 && (
          <div className="mt-4">
            <Cap light>Pinakamadalas na dahilan</Cap>
            {a.reasons.map((r) => <div key={r.reason} className="flex min-h-10 items-center justify-between border-t border-white/10 text-[0.9rem] first:border-t-0"><span>{r.reason}</span><b>{r.count}</b></div>)}
          </div>
        )}
        {a.avgRespMin === null && <p className="mt-3 text-xs text-blue-100">Walang biyaheng may naka-tala na oras ng pag-alis, kaya wala pang karaniwang sagot.</p>}
      </Hero>

      <Hero title="Botika" rag={rag.botika}>
        <div className="grid grid-cols-3 gap-2">
          <HeroStat value={data.botika.given} label="Gamot na naibigay" />
          <HeroStat value={data.botika.low.length} label="Paubos na" tone={data.botika.low.length ? "warn" : undefined} />
          <HeroStat value={data.botika.expiring.length} label="Malapit mag-expire" tone={data.botika.expiring.length ? "bad" : undefined} />
        </div>
      </Hero>

      {(data.botika.low.length > 0 || data.botika.expiring.length > 0) && (
        <Card>
          {data.botika.low.length > 0 && (
            <div><h2 className="mb-1 text-[1.05rem] font-bold">Kailangang i-restock</h2>
              {data.botika.low.slice(0, 5).map((m) => <Row key={m.name} right={<RagChip rag={m.stock === 0 ? "r" : "y"} label={`${m.stock} natitira`} />}>{m.name}<span className="block text-xs text-gray-600">Pinakamababa: {m.min}</span></Row>)}
            </div>
          )}
          {data.botika.expiring.length > 0 && (
            <div className={data.botika.low.length > 0 ? "mt-4" : ""}><h2 className="mb-1 text-[1.05rem] font-bold">Malapit mag-expire</h2>
              {data.botika.expiring.slice(0, 5).map((m) => <Row key={m.name + m.expiry} right={<RagChip rag={m.days < 0 ? "r" : "y"} label={m.days < 0 ? "Expired" : `${m.days} araw`} />}>{m.name}<span className="block text-xs text-gray-600">{m.expiry}</span></Row>)}
            </div>
          )}
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-[1.05rem] font-bold">Bakuna at buntis</h2>
        <div className="grid grid-cols-[8rem_minmax(0,1fr)_2.6rem] items-center gap-2 text-[0.85rem]">
          <span>Updated ang bakuna</span><Track pct={data.vaccine.completePct ?? 0} color="bg-emerald-600" /><b className="text-right">{data.vaccine.completePct === null ? "—" : `${data.vaccine.completePct}%`}</b>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat value={data.vaccine.childrenDelayed} label="Sanggol na delayed" tone={data.vaccine.childrenDelayed ? "text-red-700" : "text-brand-deep"} />
          <Stat value={data.pregnancy.active} label="Aktibong buntis" />
          <Stat value={data.pregnancy.checkupSoon} label="Check-up sa 7 araw" />
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 text-[1.05rem] font-bold">Sektor na dapat alagaan</h2>
        <Row right={<b>{data.sectors.senior}</b>}>Senior citizen</Row>
        <Row right={<b>{data.sectors.pwd}</b>}>PWD</Row>
        <Row right={<b>{data.sectors.solo}</b>}>Solo parent</Row>
      </Card>
    </div>
  );
}

/* ---------------- Proyekto at pondo ---------------- */

const STATUS_RAG: Record<string, Rag> = { completed: "g", ongoing: "n", planned: "n", delayed: "r" };

export function ProyektoTab({ data, loading, pondoRag }: { data: ProjectData | null; loading: boolean; pondoRag: Rag }) {
  if (loading || !data) return <Loading />;
  const b = data.budget;
  const used = b && b.total > 0 ? Math.round((b.spent / b.total) * 100) : null;
  const seg = (n: number) => (data.total ? (n / data.total) * 100 : 0);
  const maxCat = Math.max(1, ...data.spendByCategory.map((c) => c.amount));
  return (
    <div className="space-y-4">
      <Hero title="Mga proyekto" rag={data.delayed > 0 ? "r" : data.total > 0 ? "g" : "n"} ragLabel={data.delayed > 0 ? `${data.delayed} naantala` : data.total > 0 ? "Walang naantala" : undefined}>
        {data.total === 0 ? (
          <NoData light>Wala pang proyektong naka-encode.</NoData>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-1.5">
              <HeroStat value={data.total} label="Lahat" />
              <HeroStat value={data.ongoing} label="Ginagawa" />
              <HeroStat value={data.completed} label="Tapos" />
              <HeroStat value={data.delayed} label="Naantala" tone={data.delayed ? "bad" : undefined} />
            </div>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-white/15" aria-hidden>
              <span className="bg-blue-300" style={{ width: `${seg(data.ongoing)}%` }} /><span className="bg-emerald-400" style={{ width: `${seg(data.completed)}%` }} /><span className="bg-red-400" style={{ width: `${seg(data.delayed)}%` }} /><span className="bg-gray-400" style={{ width: `${seg(data.planned)}%` }} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 text-[0.7rem] text-blue-100"><span>Ginagawa</span><span>Tapos na</span><span>Naantala</span><span>Nakaplano</span></div>
          </>
        )}
      </Hero>

      {data.top.length > 0 && (
        <Card className="!pb-2">
          <h2 className="text-[1.05rem] font-bold">Pinakamahalagang proyekto</h2>
          {data.top.map((p) => (
            <div key={p.id} className="space-y-1.5 border-t border-line py-3 first:border-t-0">
              <div className="flex items-center justify-between gap-2"><b className="min-w-0 truncate text-[0.92rem]">{p.name}</b><RagChip rag={STATUS_RAG[p.status] ?? "n"} label={(PROJECT_STATUS_LABEL as Record<string, string>)[p.status] ?? p.status} /></div>
              <Track pct={p.progress} color={p.status === "delayed" ? "bg-red-700" : p.status === "completed" ? "bg-emerald-600" : "bg-brand"} />
              <span className="block text-xs text-gray-600">{p.progress}% · {formatPeso(p.budget)}{p.targetDate ? ` · Target: ${p.targetDate}` : ""}</span>
            </div>
          ))}
        </Card>
      )}

      <Hero title={`Pondo ng barangay ${data.year}`} rag={pondoRag}>
        {!b || used === null ? (
          <NoData light>Wala pang badyet na naka-encode para sa {data.year}. Ilagay ito sa Pondo / Transparency.</NoData>
        ) : (
          <>
            <div className="flex items-baseline gap-2"><span className="text-[2rem] font-extrabold leading-tight">{used}%</span><span className="text-sm text-blue-100">ng taunang badyet ang nagamit</span></div>
            <div className="my-2"><Track dark pct={used} color="bg-blue-300" /></div>
            <div className="flex justify-between text-[0.78rem] text-blue-100"><span>Nagastos {formatPeso(b.spent)}</span><span>Badyet {formatPeso(b.total)}</span></div>
            {data.spendByCategory.length > 0 && (
              <div className="mt-4 space-y-1.5"><Cap light>Gastos ayon sa uri</Cap>
                {data.spendByCategory.map((c) => (
                  <div key={c.name} className="grid grid-cols-[7.4rem_minmax(0,1fr)_4.6rem] items-center gap-2 text-[0.85rem]"><span className="truncate">{c.name}</span><Track dark pct={(c.amount / maxCat) * 100} color="bg-blue-300" /><b className="text-right text-[0.78rem]">{formatPeso(c.amount)}</b></div>
                ))}
              </div>
            )}
          </>
        )}
      </Hero>
    </div>
  );
}

/* ---------------- Ayuda at residente ---------------- */

export function AyudaTab({ data, loading, extras, ragAyuda }: { data: AyudaData | null; loading: boolean; extras: { label: string; value: number }[]; ragAyuda: Rag }) {
  if (loading || !data) return <Loading />;
  const all = data.qualified + data.scheduled + data.claimed;
  const maxP = Math.max(1, ...data.puroks.map((r) => r.members));
  return (
    <div className="space-y-4">
      <Hero title="Ayuda" rag={ragAyuda}>
        {all === 0 ? (
          <NoData light>Wala pang naka-encode na ayuda.</NoData>
        ) : (
          <>
            <div className="flex items-baseline gap-2"><span className="text-[2rem] font-extrabold leading-tight">{data.claimedPct}%</span><span className="text-sm text-blue-100">ng qualified ang nakakuha na</span></div>
            <div className="mt-3 space-y-1.5">
              <Cap light>Daloy ng ayuda</Cap>
              <div className="grid grid-cols-[7rem_minmax(0,1fr)_2.4rem] items-center gap-2 text-[0.85rem]"><span>Qualified</span><Track dark pct={(data.qualified / all) * 100} color="bg-blue-300" /><b className="text-right">{data.qualified}</b></div>
              <div className="grid grid-cols-[7rem_minmax(0,1fr)_2.4rem] items-center gap-2 text-[0.85rem]"><span>Naka-schedule</span><Track dark pct={(data.scheduled / all) * 100} color="bg-amber-300" /><b className="text-right">{data.scheduled}</b></div>
              <div className="grid grid-cols-[7rem_minmax(0,1fr)_2.4rem] items-center gap-2 text-[0.85rem]"><span>Nakuha na</span><Track dark pct={(data.claimed / all) * 100} color="bg-emerald-400" /><b className="text-right">{data.claimed}</b></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <HeroStat value={data.qualified + data.scheduled} label="Hindi pa nakukuha" tone="warn" />
              <HeroStat value={data.batches} label="Batch na nagawa" />
            </div>
          </>
        )}
      </Hero>

      <Card>
        <h2 className="mb-3 text-[1.05rem] font-bold">Mga residente</h2>
        <div className="grid grid-cols-3 gap-2">
          <Stat value={data.residents.total} label="Account" />
          <Stat value={data.residents.households} label="Household" />
          <Stat value={`${data.residents.total ? Math.round((data.residents.verified / data.residents.total) * 100) : 0}%`} label="Verified" />
        </div>
        {data.puroks.length > 0 && (
          <div className="mt-4 space-y-1"><Cap>Account bawat purok</Cap>
            {data.puroks.map((r) => (
              <div key={r.purok} className="grid grid-cols-[5.6rem_minmax(0,1fr)_3rem] items-center gap-2 text-[0.85rem]"><span className="truncate">{r.purok}</span><Track pct={(r.members / maxP) * 100} /><b className="text-right">{r.members}</b></div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-[1.05rem] font-bold">Reklamo at iba pang serbisyo</h2>
        <Row right={<b>{data.complaints.open}</b>}>Reklamo: bukas pa</Row>
        <Row right={<b>{data.complaints.closed}</b>}>Reklamo: naayos o isinara</Row>
        {extras.map((e) => <Row key={e.label} right={<b>{e.value}</b>}>{e.label}</Row>)}
      </Card>
    </div>
  );
}
