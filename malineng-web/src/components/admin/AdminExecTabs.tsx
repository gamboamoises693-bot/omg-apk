"use client";

import type { ReactNode } from "react";
import { Card, Spinner } from "@/components/ui";
import { formatPeso } from "@/lib/format";
import { RAG_RULES, RAG_WORD, type AttentionItem, type AyudaData, type HealthData, type ProjectData, type Rag, type Scorecard } from "@/lib/executive";
import { PROJECT_STATUS_LABEL } from "@/lib/constants";

export type ExecTab = "buod" | "kalusugan" | "proyekto" | "ayuda" | "transaksyon";

const RAG_CLASS: Record<Rag, string> = {
  g: "bg-emerald-50 text-emerald-700",
  y: "bg-yellow-50 text-yellow-900",
  r: "bg-red-50 text-red-700",
  n: "bg-[#EDF0F5] text-gray-600",
};
const RAG_DOT: Record<Rag, string> = { g: "bg-emerald-600", y: "bg-amber-600", r: "bg-red-700", n: "bg-gray-400" };

/** Status chip: always a word and a dot, never colour alone. */
export function RagChip({ rag, label }: { rag: Rag; label?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.62rem] font-extrabold uppercase ${RAG_CLASS[rag]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${RAG_DOT[rag]}`} aria-hidden />
      {label ?? RAG_WORD[rag]}
    </span>
  );
}

function Stat({ value, label, tone = "text-brand-deep", bg = "bg-surface" }: { value: ReactNode; label: string; tone?: string; bg?: string }) {
  return (
    <div className={`flex flex-col gap-0.5 rounded-2xl p-3 ${bg}`}>
      <b className={`text-[1.5rem] font-extrabold leading-tight tabular-nums ${tone}`}>{value}</b>
      <span className="text-[0.74rem] font-bold text-gray-600">{label}</span>
    </div>
  );
}

function Cap({ children }: { children: ReactNode }) {
  return <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-gray-600">{children}</p>;
}

function Track({ pct, color = "bg-brand" }: { pct: number; color?: string }) {
  return (
    <span className="block h-3 overflow-hidden rounded-full bg-[#EDF0F5]" aria-hidden>
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
const NoData = ({ children }: { children: ReactNode }) => <p className="py-3 text-sm text-gray-600">{children}</p>;

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
          {card.items.map((it) => (
            <div key={it.key} className="flex flex-col gap-1 rounded-2xl border border-line bg-white p-3 shadow-card">
              <div className="flex items-center justify-between gap-1"><span className="text-[0.72rem] font-extrabold uppercase tracking-wide text-gray-600">{it.label}</span><RagChip rag={it.rag} /></div>
              <b className="text-[1.9rem] font-extrabold leading-tight tabular-nums text-brand-deep">{it.value}</b>
              <span className="text-xs text-gray-600">{it.note}</span>
            </div>
          ))}
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
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.tone === "r" ? "bg-red-700" : "bg-amber-600"}`} aria-hidden />
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
      <Card>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-[1.05rem] font-bold">Ambulansya at emergency</h2><RagChip rag={rag.emergency} /></div>
        <div className="grid grid-cols-3 gap-2">
          <Stat value={a.trips} label="Biyahe sa panahong ito" />
          <Stat value={a.avgRespMin === null ? "—" : `${a.avgRespMin} min`} label="Karaniwang sagot" />
          <Stat value={a.waiting} label="Naghihintay" tone={a.waiting ? "text-red-700" : "text-brand-deep"} bg={a.waiting ? "bg-red-50" : "bg-surface"} />
        </div>
        <div className="mt-4 space-y-1"><Cap>Uri ng biyahe</Cap>
          <div className="grid grid-cols-[7rem_minmax(0,1fr)_2rem] items-center gap-2 text-[0.85rem]"><span>Emergency</span><Track pct={(a.emergency / maxType) * 100} color="bg-red-700" /><b className="text-right">{a.emergency}</b></div>
          <div className="grid grid-cols-[7rem_minmax(0,1fr)_2rem] items-center gap-2 text-[0.85rem]"><span>Naka-schedule</span><Track pct={(a.scheduled / maxType) * 100} /><b className="text-right">{a.scheduled}</b></div>
        </div>
        {a.reasons.length > 0 && (
          <div className="mt-4"><Cap>Pinakamadalas na dahilan</Cap>{a.reasons.map((r) => <Row key={r.reason} right={<b>{r.count}</b>}>{r.reason}</Row>)}</div>
        )}
        {a.avgRespMin === null && <p className="mt-3 text-xs text-gray-600">Walang biyaheng may naka-tala na oras ng pag-alis, kaya wala pang karaniwang sagot.</p>}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-[1.05rem] font-bold">Botika</h2><RagChip rag={rag.botika} /></div>
        <div className="grid grid-cols-3 gap-2">
          <Stat value={data.botika.given} label="Gamot na naibigay" />
          <Stat value={data.botika.low.length} label="Paubos na" tone={data.botika.low.length ? "text-yellow-900" : "text-brand-deep"} bg={data.botika.low.length ? "bg-yellow-50" : "bg-surface"} />
          <Stat value={data.botika.expiring.length} label="Malapit mag-expire" tone={data.botika.expiring.length ? "text-red-700" : "text-brand-deep"} bg={data.botika.expiring.length ? "bg-red-50" : "bg-surface"} />
        </div>
        {data.botika.low.length > 0 && (
          <div className="mt-4"><Cap>Kailangang i-restock</Cap>
            {data.botika.low.slice(0, 5).map((m) => <Row key={m.name} right={<RagChip rag={m.stock === 0 ? "r" : "y"} label={`${m.stock} natitira`} />}>{m.name}<span className="block text-xs text-gray-600">Pinakamababa: {m.min}</span></Row>)}
          </div>
        )}
        {data.botika.expiring.length > 0 && (
          <div className="mt-4"><Cap>Malapit mag-expire</Cap>
            {data.botika.expiring.slice(0, 5).map((m) => <Row key={m.name + m.expiry} right={<RagChip rag={m.days < 0 ? "r" : "y"} label={m.days < 0 ? "Expired" : `${m.days} araw`} />}>{m.name}<span className="block text-xs text-gray-600">{m.expiry}</span></Row>)}
          </div>
        )}
      </Card>

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
      <Card>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-[1.05rem] font-bold">Mga proyekto</h2>{data.delayed > 0 && <RagChip rag="r" label={`${data.delayed} naantala`} />}</div>
        {data.total === 0 ? (
          <NoData>Wala pang proyektong naka-encode.</NoData>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-1.5">
              <Stat value={data.total} label="Lahat" />
              <Stat value={data.ongoing} label="Ginagawa" tone="text-brand-dark" />
              <Stat value={data.completed} label="Tapos" tone="text-emerald-700" />
              <Stat value={data.delayed} label="Naantala" tone="text-red-700" />
            </div>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[#EDF0F5]" aria-hidden>
              <span className="bg-brand" style={{ width: `${seg(data.ongoing)}%` }} /><span className="bg-emerald-600" style={{ width: `${seg(data.completed)}%` }} /><span className="bg-red-700" style={{ width: `${seg(data.delayed)}%` }} /><span className="bg-gray-300" style={{ width: `${seg(data.planned)}%` }} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 text-[0.7rem] text-gray-600"><span>Ginagawa</span><span>Tapos na</span><span>Naantala</span><span>Nakaplano</span></div>
          </>
        )}
      </Card>

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

      <Card>
        <div className="mb-1 flex items-center justify-between"><h2 className="text-[1.05rem] font-bold">Pondo ng barangay {data.year}</h2><RagChip rag={pondoRag} /></div>
        {!b || used === null ? (
          <NoData>Wala pang badyet na naka-encode para sa {data.year}. Ilagay ito sa Pondo / Transparency.</NoData>
        ) : (
          <>
            <div className="flex items-baseline gap-2"><span className="text-[1.9rem] font-extrabold leading-tight text-brand-deep">{used}%</span><span className="text-sm text-gray-600">ng taunang badyet ang nagamit</span></div>
            <div className="my-2"><Track pct={used} /></div>
            <div className="flex justify-between text-[0.78rem] text-gray-600"><span>Nagastos {formatPeso(b.spent)}</span><span>Badyet {formatPeso(b.total)}</span></div>
            {data.spendByCategory.length > 0 && (
              <div className="mt-4 space-y-1"><Cap>Gastos ayon sa uri</Cap>
                {data.spendByCategory.map((c) => (
                  <div key={c.name} className="grid grid-cols-[7.4rem_minmax(0,1fr)_4.6rem] items-center gap-2 text-[0.85rem]"><span className="truncate">{c.name}</span><Track pct={(c.amount / maxCat) * 100} /><b className="text-right text-[0.78rem]">{formatPeso(c.amount)}</b></div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>
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
      <Card>
        <div className="mb-1 flex items-center justify-between"><h2 className="text-[1.05rem] font-bold">Ayuda</h2><RagChip rag={ragAyuda} /></div>
        {all === 0 ? (
          <NoData>Wala pang naka-encode na ayuda.</NoData>
        ) : (
          <>
            <div className="flex items-baseline gap-2"><span className="text-[1.9rem] font-extrabold leading-tight text-brand-deep">{data.claimedPct}%</span><span className="text-sm text-gray-600">ng qualified ang nakakuha na</span></div>
            <div className="mt-3 space-y-1">
              <Cap>Daloy ng ayuda</Cap>
              <div className="grid grid-cols-[7rem_minmax(0,1fr)_2.4rem] items-center gap-2 text-[0.85rem]"><span>Qualified</span><Track pct={(data.qualified / all) * 100} /><b className="text-right">{data.qualified}</b></div>
              <div className="grid grid-cols-[7rem_minmax(0,1fr)_2.4rem] items-center gap-2 text-[0.85rem]"><span>Naka-schedule</span><Track pct={(data.scheduled / all) * 100} /><b className="text-right">{data.scheduled}</b></div>
              <div className="grid grid-cols-[7rem_minmax(0,1fr)_2.4rem] items-center gap-2 text-[0.85rem]"><span>Nakuha na</span><Track pct={(data.claimed / all) * 100} color="bg-emerald-600" /><b className="text-right">{data.claimed}</b></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stat value={data.qualified + data.scheduled} label="Hindi pa nakukuha" tone="text-yellow-900" bg="bg-yellow-50" />
              <Stat value={data.batches} label="Batch na nagawa" />
            </div>
          </>
        )}
      </Card>

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
