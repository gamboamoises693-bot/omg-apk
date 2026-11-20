"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, FileText, Home, RefreshCw, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAdminPending } from "@/context/AdminPendingContext";
import { useToast } from "@/components/Toast";
import { Avatar } from "@/components/Avatar";
import { useOnlineCount } from "@/lib/presence";
import { Badge, Button, Card, EmptyState, SectionTitle, Spinner } from "@/components/ui";
import { downloadCsv } from "@/lib/csv";
import { downloadDashboardPdf, loadSealPng } from "@/lib/dashboardPdf";
import { logActivity, roleLabel } from "@/lib/activity";
import { friendlyError } from "@/lib/format";
import { useCaptainSignature } from "@/lib/signature";
import {
  PERIOD_LABEL,
  STATUS_WORD,
  dayHeading,
  formatWhen,
  loadTransactions,
  periodTitle,
  rangeFor,
  splitPeriods,
  summarize,
  type Loaded,
  type Period,
  type Txn,
  type TxnStatus,
} from "@/lib/transactions";

/** Admin tabs that hold things waiting on someone, with the words shown on the dashboard. */
const ACTION_ROWS: { tab: string; label: string }[] = [
  { tab: "ambulansya", label: "Ambulansya" },
  { tab: "appointments", label: "Appointment at clearance" },
  { tab: "blotter", label: "Reklamo" },
  { tab: "verification", label: "Pag-verify ng account" },
  { tab: "profilechange", label: "Pagbabago sa profile" },
  { tab: "hiraman", label: "Hiraman ng gamit" },
  { tab: "rafflepledge", label: "Donasyon sa raffle" },
  { tab: "hallregister", label: "Rehistro sa Hall" },
  { tab: "helpsetup", label: "Tulong sa setup" },
  { tab: "approve", label: "Post, paninda at trabaho" },
];

const TAB_LABEL: Record<string, string> = {
  ambulansya: "Ambulansya",
  appointments: "Appointments",
  blotter: "Blotter / Reklamo",
  hiraman: "Hiraman",
  rafflepledge: "Raffle: Donasyon",
  approve: "I-approve",
};

const STATUS_BADGE: Record<TxnStatus, "gold" | "green" | "gray"> = { pending: "gold", done: "green", rejected: "gray" };

/** Opens another admin section (the admin page listens to the URL hash). */
const goToTab = (tab: string) => {
  window.location.hash = tab;
};

type View = { name: "home" } | { name: "list" } | { name: "detail"; txn: Txn };

export function AdminDashboard() {
  const { profile } = useAuth();
  const { byTab, total: waiting } = useAdminPending();
  const online = useOnlineCount();
  const toast = useToast();
  const signature = useCaptainSignature();
  const [period, setPeriod] = useState<Period>("week");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ name: "home" });
  const [pdfBusy, setPdfBusy] = useState(false);

  const range = useMemo(() => rangeFor(period), [period]);

  const load = useCallback(
    async (force = false) => {
      setLoading(true);
      try {
        // One read covers this period and the one before it, so the "change" figure costs nothing extra.
        setLoaded(await loadTransactions(range.prevStart, range.end, force));
      } catch (err) {
        toast(friendlyError(err), "error");
      } finally {
        setLoading(false);
      }
    },
    [range, toast],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const { current, previous } = useMemo(() => splitPeriods(loaded?.txns ?? [], range), [loaded, range]);
  const summary = useMemo(() => summarize(current, previous), [current, previous]);
  const title = periodTitle(period, range);

  const exportCsv = () => {
    downloadCsv(`transaksyon-${period}.csv`, [
      ["Petsa", "Oras", "Residente", "Serbisyo", "Detalye", "Katayuan", "Reference", "Purok", "Huling kumilos"],
      ...current.map((t) => [
        new Date(t.at).toLocaleDateString("fil-PH"),
        new Date(t.at).toLocaleTimeString("fil-PH"),
        t.name,
        t.service,
        t.detail,
        t.statusLabel,
        t.ref,
        t.purok,
        t.handledBy,
      ]),
    ]);
    logActivity("Settings", `Nag-export ng CSV ng transaksyon (${PERIOD_LABEL[period]})`);
  };

  const exportPdf = async () => {
    setPdfBusy(true);
    try {
      const seal = await loadSealPng();
      await downloadDashboardPdf(
        {
          periodLabel: PERIOD_LABEL[period],
          rangeText: title,
          summary,
          txns: current,
          preparedBy: profile?.fullName ?? "",
          preparedRole: profile ? roleLabel(profile.role, profile.position) : "",
          captainName: signature.name,
          seal,
          truncated: (loaded?.truncated.length ?? 0) > 0,
        },
        `ulat-transaksyon-${period}-${new Date().toISOString().slice(0, 10)}.pdf`,
      );
      logActivity("Settings", `Gumawa ng PDF na ulat ng transaksyon (${PERIOD_LABEL[period]})`);
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setPdfBusy(false);
    }
  };

  if (view.name === "list") return <TxnList txns={current} title={title} onBack={() => setView({ name: "home" })} onOpen={(txn) => setView({ name: "detail", txn })} onCsv={exportCsv} />;
  if (view.name === "detail") return <TxnDetail txn={view.txn} onBack={() => setView({ name: "list" })} />;

  const actions = ACTION_ROWS.map((r) => ({ ...r, n: byTab[r.tab] ?? 0 })).filter((r) => r.n > 0);
  const top = Math.max(1, ...summary.byService.map((s) => s.count));

  const hour = new Date().getHours();
  const hello = hour < 12 ? "Magandang umaga" : hour < 18 ? "Magandang hapon" : "Magandang gabi";
  const first = (profile?.fullName ?? "").split(" ")[0];
  const enroute = (loaded?.txns ?? []).filter((t) => t.service === "Ambulansya" && t.statusLabel === "Papunta na").length;

  return (
    <div className="space-y-4">
      {/* Greeting and what is happening right now */}
      <section className="rounded-[1.125rem] bg-gradient-to-br from-brand-dark to-brand-deep p-4 text-white shadow-card">
        <div className="flex items-center gap-3">
          {profile && <Avatar name={profile.fullName} photo={profile.photoURL} size="h-12 w-12" textClass="text-base" ring="ring-2 ring-white/30" />}
          <div className="min-w-0 flex-1">
            <p className="text-[0.8rem] text-white/85">{hello}{profile?.position ? `, ${profile.position}` : ""}</p>
            <p className="truncate text-[1.15rem] font-extrabold leading-tight">{first || "Kapitan"}</p>
          </div>
          <Link href="/" className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-[0.8rem] font-bold active:bg-white/25">
            <Home className="h-4 w-4" aria-hidden /> Website
          </Link>
        </div>
        <p className="mt-3 text-[0.78rem] text-white/80">{new Date().toLocaleDateString("fil-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · Kalagayan ng barangay</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/10 px-2.5 py-2"><p className="text-[1.6rem] font-extrabold leading-tight tabular-nums">{waiting}</p><p className="text-[0.7rem] font-bold text-blue-100">Naghihintay</p></div>
          <div className={`rounded-xl px-2.5 py-2 ${enroute > 0 ? "bg-red-600/80" : "bg-white/10"}`}><p className="text-[1.6rem] font-extrabold leading-tight tabular-nums">{enroute}</p><p className="text-[0.7rem] font-bold text-blue-100">Ambulansya sa daan</p></div>
          <div className="rounded-xl bg-white/10 px-2.5 py-2"><p className="text-[1.6rem] font-extrabold leading-tight tabular-nums">{online ?? "—"}</p><p className="text-[0.7rem] font-bold text-blue-100">Online ngayon</p></div>
        </div>
      </section>

      {/* Period */}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Panahon">
        {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={p === period}
            onClick={() => setPeriod(p)}
            className={`min-h-10 shrink-0 rounded-full px-4 text-[0.8rem] font-bold ${p === period ? "bg-brand-dark text-white" : "border border-gray-300 bg-white text-brand-dark"}`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
        <button onClick={() => void load(true)} className="ml-auto flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-[0.8rem] font-bold text-brand" aria-label="I-refresh ang datos">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden /> I-refresh
        </button>
      </div>
      <p className="text-xs text-gray-600">{title}</p>

      {loading && !loaded && <Spinner label="Kinukuha ang mga transaksyon..." />}

      {loaded && (
        <>
          {loaded.failed.length > 0 && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">Hindi nabasa: {loaded.failed.join(", ")}. Baka wala kang pahintulot o may problema sa koneksyon.</p>
          )}
          {loaded.truncated.length > 0 && (
            <p className="rounded-xl bg-yellow-50 px-3 py-2 text-xs text-yellow-900">Napakarami ng {loaded.truncated.join(", ")}; unang 800 lang ang binasa. Pumili ng mas maikling panahon para sa eksaktong bilang.</p>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Kabuuang transaksyon" value={summary.total} tone="text-brand-dark" note={summary.change === null ? "Walang ikukumpara" : `${summary.change >= 0 ? "+" : ""}${summary.change}% sa nakaraang panahon`} noteTone={summary.change !== null && summary.change >= 0 ? "text-emerald-700" : "text-gray-600"} />
            <Kpi label="Naghihintay" value={summary.pending} tone="text-yellow-900" note="Hindi pa tapos" />
            <Kpi label="Tapos na" value={summary.done} tone="text-emerald-700" note={summary.total ? `${Math.round((summary.done / summary.total) * 100)}% ng lahat` : "—"} />
            <Kpi label="Hindi natuloy" value={summary.rejected} tone="text-red-700" note={summary.total ? `${Math.round((summary.rejected / summary.total) * 100)}% ng lahat` : "—"} />
          </div>

          {/* Waiting on someone (live, from the admin badges) */}
          <Card className="!pb-2">
            <h2 className="text-[1.05rem] font-bold">Kailangan ng aksyon</h2>
            {actions.length === 0 ? (
              <p className="py-3 text-sm text-gray-600">Walang naghihintay ngayon.</p>
            ) : (
              <ul className="mt-1">
                {actions.map((a) => (
                  <li key={a.tab} className="border-t border-line first:border-t-0">
                    <button onClick={() => goToTab(a.tab)} className="flex min-h-11 w-full items-center gap-3 text-left text-[0.95rem]">
                      <span className="flex-1">{a.label}</span>
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-50 px-1.5 text-[0.8rem] font-extrabold text-red-700">{a.n}</span>
                      <ChevronRight className="h-4 w-4 text-gray-500" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* By service */}
          <Card>
            <h2 className="text-[1.05rem] font-bold">Transaksyon ayon sa serbisyo</h2>
            <p className="mb-2 text-xs text-gray-600">{summary.total} lahat</p>
            {summary.byService.length === 0 ? (
              <p className="py-3 text-sm text-gray-600">Walang transaksyon sa panahong ito.</p>
            ) : (
              <ul className="space-y-1.5">
                {summary.byService.map((s) => (
                  <li key={s.service} className="grid grid-cols-[7.2rem_minmax(0,1fr)_2rem] items-center gap-2 text-[0.85rem]">
                    <span className="truncate">{s.service}</span>
                    <span className="h-3 rounded-full bg-surface" aria-hidden>
                      <span className="block h-3 rounded-full bg-brand" style={{ width: `${Math.max(4, (s.count / top) * 100)}%` }} />
                    </span>
                    <b className="text-right tabular-nums">{s.count}</b>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Recent */}
          <Card className="!pb-1">
            <div className="flex items-center justify-between">
              <h2 className="text-[1.05rem] font-bold">Pinakabago</h2>
              <button onClick={() => setView({ name: "list" })} className="min-h-10 text-[0.85rem] font-bold text-brand">Tingnan lahat</button>
            </div>
            {current.length === 0 ? (
              <p className="py-3 text-sm text-gray-600">Wala pa.</p>
            ) : (
              <ul>
                {current.slice(0, 5).map((t) => (
                  <li key={t.key} className="border-t border-line">
                    <TxnRow txn={t} onOpen={() => setView({ name: "detail", txn: t })} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="grid gap-2">
            <Button full loading={pdfBusy} onClick={() => void exportPdf()} disabled={current.length === 0}>
              <FileText className="h-4 w-4" /> I-download ang PDF na ulat
            </Button>
            <Button variant="outline" full onClick={exportCsv} disabled={current.length === 0}>
              <Download className="h-4 w-4" /> I-export bilang CSV
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, tone, note, noteTone = "text-gray-600" }: { label: string; value: number; tone: string; note: string; noteTone?: string }) {
  return (
    <Card className="!p-3.5">
      <p className="text-[0.8rem] font-bold text-gray-600">{label}</p>
      <p className={`text-[2rem] font-extrabold leading-tight tabular-nums ${tone}`}>{value}</p>
      <p className={`text-xs ${noteTone}`}>{note}</p>
    </Card>
  );
}

function TxnRow({ txn, onOpen }: { txn: Txn; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex w-full flex-col gap-1 py-3 text-left">
      <span className="flex items-center justify-between gap-2">
        <b className="truncate text-[0.95rem]">{txn.name}</b>
        <span className="flex shrink-0 items-center gap-1">
          {txn.urgent && txn.status === "pending" && <Badge color="red">Urgent</Badge>}
          <Badge color={STATUS_BADGE[txn.status]}>{txn.statusLabel}</Badge>
        </span>
      </span>
      <span className="truncate text-[0.9rem] text-gray-800">{txn.service} · {txn.detail}</span>
      <span className="text-xs text-gray-600">{formatWhen(txn.at)}{txn.purok ? ` · ${txn.purok}` : ""} · {txn.ref}</span>
    </button>
  );
}

const PAGE = 30;

function TxnList({ txns, title, onBack, onOpen, onCsv }: { txns: Txn[]; title: string; onBack: () => void; onOpen: (t: Txn) => void; onCsv: () => void }) {
  const [q, setQ] = useState("");
  const [service, setService] = useState("lahat");
  const [status, setStatus] = useState<"lahat" | TxnStatus>("lahat");
  const [shown, setShown] = useState(PAGE);

  const services = useMemo(() => Array.from(new Set(txns.map((t) => t.service))), [txns]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return txns.filter(
      (t) =>
        (service === "lahat" || t.service === service) &&
        (status === "lahat" || t.status === status) &&
        (!needle || `${t.name} ${t.ref} ${t.detail}`.toLowerCase().includes(needle)),
    );
  }, [txns, q, service, status]);

  const visible = rows.slice(0, shown);
  let lastDay = "";

  const chip = (on: boolean) => `min-h-10 shrink-0 rounded-full border px-4 text-[0.8rem] font-bold ${on ? "border-brand-dark bg-brand-dark text-white" : "border-gray-300 bg-white text-brand-dark"}`;

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="flex min-h-10 items-center gap-1 text-sm font-bold text-brand"><ChevronLeft className="h-4 w-4" aria-hidden /> Dashboard</button>
      <div>
        <h2 className="text-lg font-extrabold">Lahat ng transaksyon</h2>
        <p className="text-xs text-gray-600">{rows.length} sa {txns.length} · {title}</p>
      </div>
      <label className="flex min-h-12 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3">
        <Search className="h-5 w-5 text-gray-600" aria-hidden />
        <span className="sr-only">Hanapin ang pangalan o reference number</span>
        <input value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Pangalan o reference no." className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none" />
      </label>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button className={chip(service === "lahat")} onClick={() => { setService("lahat"); setShown(PAGE); }}>Lahat</button>
        {services.map((s) => <button key={s} className={chip(service === s)} onClick={() => { setService(s); setShown(PAGE); }}>{s}</button>)}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button className={chip(status === "lahat")} onClick={() => { setStatus("lahat"); setShown(PAGE); }}>Lahat</button>
        {(Object.keys(STATUS_WORD) as TxnStatus[]).map((s) => <button key={s} className={chip(status === s)} onClick={() => { setStatus(s); setShown(PAGE); }}>{STATUS_WORD[s]}</button>)}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Walang tugma">Subukan ang ibang salita o filter.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-[1.125rem] border border-line bg-white shadow-card">
          {visible.map((t) => {
            const day = dayHeading(t.at);
            const head = day !== lastDay;
            lastDay = day;
            return (
              <div key={t.key}>
                {head && <p className="bg-[#EDF0F5] px-4 py-2 text-[0.72rem] font-extrabold uppercase tracking-wide text-gray-600">{day}</p>}
                <div className="border-t border-line px-4 first:border-t-0"><TxnRow txn={t} onOpen={() => onOpen(t)} /></div>
              </div>
            );
          })}
        </div>
      )}
      {rows.length > shown && <Button variant="soft" full onClick={() => setShown((n) => n + PAGE)}>Magpakita pa ({rows.length - shown})</Button>}
      <Button variant="outline" full onClick={onCsv}><Download className="h-4 w-4" /> I-export bilang CSV</Button>
    </div>
  );
}

function TxnDetail({ txn, onBack }: { txn: Txn; onBack: () => void }) {
  const rows: [string, string][] = [
    ["Residente", txn.name],
    ["Serbisyo", txn.service],
    ["Detalye", txn.detail],
    ["Isinumite", new Date(txn.at).toLocaleString("fil-PH", { dateStyle: "long", timeStyle: "short" })],
    ["Reference", txn.ref],
    ...(txn.purok ? ([["Purok", txn.purok]] as [string, string][]) : []),
    ...(txn.contact ? ([["Contact", txn.contact]] as [string, string][]) : []),
    ["Huling kumilos", txn.handledBy || "—"],
  ];
  return (
    <div className="space-y-3">
      <button onClick={onBack} className="flex min-h-10 items-center gap-1 text-sm font-bold text-brand"><ChevronLeft className="h-4 w-4" aria-hidden /> Listahan</button>
      <Card>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Impormasyon</h2>
          <Badge color={STATUS_BADGE[txn.status]}>{txn.statusLabel}</Badge>
        </div>
        <dl>
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2 border-t border-line py-2 text-[0.9rem] first:border-t-0">
              <dt className="text-[0.8rem] font-bold text-gray-600">{k}</dt>
              <dd className="break-words">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-bold">Kasaysayan</h2>
        {txn.trail.length === 0 ? (
          <p className="text-sm text-gray-600">Walang naka-tala pang hakbang para sa ganitong uri ng transaksyon.</p>
        ) : (
          <ol className="space-y-3">
            {txn.trail.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-emerald-600" aria-hidden />
                <span className="text-[0.9rem]">
                  <b>{e.text || "Kumilos"}</b>
                  <span className="block text-xs text-gray-600">{e.name}{e.role ? ` (${e.role})` : ""}{e.at ? ` · ${formatWhen(e.at)}` : ""}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {txn.tab && (
        <>
          <Button full onClick={() => goToTab(txn.tab)}>Buksan sa {TAB_LABEL[txn.tab] ?? "admin"}</Button>
          <p className="text-center text-xs text-gray-600">Doon ginagawa ang pag-apruba o pag-reject, at may log ang bawat aksyon.</p>
        </>
      )}
    </div>
  );
}
