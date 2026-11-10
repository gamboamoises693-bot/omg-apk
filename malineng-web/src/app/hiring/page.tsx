"use client";

import { useMemo, useState } from "react";
import { collection, query, where } from "firebase/firestore";
import { Briefcase, Plus, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { sortNewest } from "@/lib/format";
import { APPLICATION_STATUS, OPENING_TYPES, deadlineLabel, openingPlace, isTakingApplications, slotsLabel, type Application, type Opening } from "@/lib/hiring";
import { Badge, Button, EmptyState, FilterTabs, Modal, PageHeader, Spinner } from "@/components/ui";
import { SidelineJobs } from "@/components/hiring/SidelineJobs";
import { OpeningForm } from "@/components/hiring/OpeningForm";
import { OpeningDetail } from "@/components/hiring/OpeningDetail";
import { RequireVerified } from "@/components/RequireVerified";
import { LoginGate } from "@/components/LoginGate";

type Tab = "bakante" | "sideline" | "inapply" | "post";
const approvedQ = query(collection(db, "openings"), where("status", "==", "approved"));

function OpeningCard({ o, onOpen, badge }: { o: Opening; onOpen: () => void; badge?: React.ReactNode }) {
  const taking = isTakingApplications(o);
  return (
    <button onClick={onOpen} className={`block w-full rounded-2xl bg-white p-3 text-left shadow-card active:bg-gray-50 ${o.official ? "border-[1.5px] border-brand/40" : ""} ${taking ? "" : "opacity-65"}`}>
      {o.official && (
        <div className="mb-1 flex items-center gap-1.5">
          <span className="rounded-full bg-brand-light px-2 py-0.5 text-[0.62rem] font-black text-brand">OPISYAL · BARANGAY</span>
          {o.deadline && <span className="text-[0.7rem] text-gray-500">{deadlineLabel(o.deadline)}</span>}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-extrabold leading-tight">{o.title}</p>
          <p className="truncate text-[0.82rem] text-gray-600">{o.employer}{openingPlace(o) ? ` · ${openingPlace(o)}` : ""}</p>
        </div>
        {badge ?? (
          <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.7rem] font-extrabold ${taking ? (o.slots - o.filled >= 5 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800") : "bg-gray-100 text-gray-600"}`}>
            {taking ? slotsLabel(o) : o.state === "closed" ? "Sarado" : o.filled >= o.slots ? "Puno na" : "Tapos na"}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[0.72rem] text-gray-700">
        <span className="rounded-lg bg-gray-100 px-2 py-0.5">{o.type}</span>
        {o.salary && <span className="rounded-lg bg-gray-100 px-2 py-0.5">{o.salary}</span>}
        {!o.official && o.deadline && taking && <span className="rounded-lg bg-gray-100 px-2 py-0.5">{deadlineLabel(o.deadline)}</span>}
        {o.applyMode === "contact" && <span className="rounded-lg bg-gray-100 px-2 py-0.5">Tumawag lang</span>}
        {o.applyMode === "link" && <span className="rounded-lg bg-gray-100 px-2 py-0.5">Sa website ng kumpanya</span>}
        {o.applyMode === "website" && <span className="rounded-lg bg-gray-100 px-2 py-0.5">Mag-apply dito</span>}
      </div>
    </button>
  );
}

export default function HiringPage() {
  const { user, isOfficer } = useAuth();
  const [tab, setTab] = useState<Tab>("bakante");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("Lahat");
  const [posting, setPosting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const approved = useCollection<Opening>(approvedQ);
  const ownQ = useMemo(() => (user ? query(collection(db, "openings"), where("posterId", "==", user.uid)) : null), [user]);
  const own = useCollection<Opening>(ownQ);
  const myAppsQ = useMemo(() => (user ? query(collection(db, "applications"), where("applicantId", "==", user.uid)) : null), [user]);
  const myApps = useCollection<Application>(myAppsQ);
  const newAppsQ = useMemo(() => (user ? query(collection(db, "applications"), where("employerId", "==", user.uid), where("status", "==", "new")) : null), [user]);
  const newApps = useCollection<Application>(newAppsQ);

  // Every opening this person may open: public approved ones plus their own (pending / rejected too).
  const byId = useMemo(() => {
    const m = new Map<string, Opening>();
    for (const o of approved.data) m.set(o.id, o);
    for (const o of own.data) m.set(o.id, o);
    return m;
  }, [approved.data, own.data]);
  const appByOpening = useMemo(() => new Map(myApps.data.map((a) => [a.openingId, a])), [myApps.data]);
  const open = openId ? byId.get(openId) ?? null : null;

  const list = useMemo(() => {
    const t = search.trim().toLowerCase();
    return approved.data
      .filter((o) => o.state !== "closed")
      .filter((o) => (type === "Lahat" ? true : type === "Opisyal" ? o.official : o.type === type))
      .filter((o) => !t || `${o.title} ${o.employer} ${o.purok} ${o.location ?? ""} ${o.requirements.join(" ")}`.toLowerCase().includes(t));
  }, [approved.data, search, type]);
  const active = sortNewest(list.filter(isTakingApplications)).sort((a, b) => Number(b.official) - Number(a.official));
  const ended = sortNewest(list.filter((o) => !isTakingApplications(o)));

  const mineApps = sortNewest(myApps.data);
  const newByOpening = (id: string) => newApps.data.filter((a) => a.openingId === id).length;

  return (
    <div>
      <PageHeader title="Hiring" subtitle="Trabahong bukas sa Malineng" action={user ? <Button variant="gold" className="!min-h-0 !px-3 !py-2 text-sm" onClick={() => setPosting(true)}><Plus className="h-4 w-4" /> Mag-post</Button> : undefined} />

      <FilterTabs
        label="Hiring"
        value={tab}
        onChange={setTab}
        options={[
          { value: "bakante", label: "Bakante" },
          { value: "sideline", label: "Sideline" },
          { value: "inapply", label: "Inapply ko", count: user ? myApps.data.length : undefined, tone: "neutral" },
          { value: "post", label: "Post ko", count: user ? newApps.data.length : undefined },
        ]}
      />

      {tab === "bakante" && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3">
            <Search className="h-4 w-4 text-gray-400" aria-hidden />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hanapin: helper, driver, cashier..." aria-label="Hanapin ang trabaho" className="w-full bg-transparent py-2.5 outline-none" />
          </label>
          <FilterTabs label="Uri ng trabaho" value={type} onChange={setType} options={["Lahat", "Opisyal", ...OPENING_TYPES].map((v) => ({ value: v, label: v }))} />
          {approved.loading ? (
            <Spinner />
          ) : active.length === 0 && ended.length === 0 ? (
            <EmptyState icon={<Briefcase />} title="Wala pang bukas na bakante">
              {isOfficer ? "Mag-post ng OPISYAL na bakante ng Barangay." : "Mag-post kung may kailangan kayong tauhan."}
            </EmptyState>
          ) : (
            <>
              {active.map((o) => <OpeningCard key={o.id} o={o} onOpen={() => setOpenId(o.id)} />)}
              {ended.length > 0 && <p className="pt-1 text-xs font-bold uppercase tracking-wide text-gray-400">Puno na / tapos na</p>}
              {ended.map((o) => <OpeningCard key={o.id} o={o} onOpen={() => setOpenId(o.id)} />)}
            </>
          )}
        </div>
      )}

      {tab === "sideline" && <SidelineJobs />}

      {tab === "inapply" && (
        <LoginGate message="Mag-login para makita ang mga inapplyan mo.">
          {myApps.loading ? (
            <Spinner />
          ) : mineApps.length === 0 ? (
            <EmptyState icon={<Briefcase />} title="Wala ka pang inapplyan" />
          ) : (
            <div className="space-y-2.5">
              {mineApps.map((a) => {
                const o = byId.get(a.openingId);
                const st = APPLICATION_STATUS[a.status];
                return (
                  <button key={a.id} onClick={() => o && setOpenId(o.id)} disabled={!o} className="block w-full rounded-2xl bg-white p-3 text-left shadow-card enabled:active:bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-extrabold leading-tight">{a.openingTitle}</p>
                        <p className="text-xs text-gray-500">{o ? o.employer : "Wala na ang bakanteng ito"}</p>
                      </div>
                      <Badge color={st.badge}>{st.label}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </LoginGate>
      )}

      {tab === "post" && (
        <LoginGate message="Mag-login para makita ang mga post mo.">
          {own.loading ? (
            <Spinner />
          ) : own.data.length === 0 ? (
            <EmptyState icon={<Briefcase />} title="Wala ka pang na-post na bakante">
              <Button variant="gold" className="mt-3" onClick={() => setPosting(true)}><Plus className="h-4 w-4" /> Mag-post ng bakante</Button>
            </EmptyState>
          ) : (
            <div className="space-y-2.5">
              {sortNewest(own.data).map((o) => {
                const n = newByOpening(o.id);
                return (
                  <OpeningCard
                    key={o.id}
                    o={o}
                    onOpen={() => setOpenId(o.id)}
                    badge={
                      o.status === "pending" ? <Badge color="gold">Naghihintay</Badge> : o.status === "rejected" ? <Badge color="red">Hindi naaprubahan</Badge> : n > 0 ? <span className="shrink-0 rounded-full bg-red-600 px-2.5 py-0.5 text-[0.7rem] font-extrabold text-white">{n} bago</span> : undefined
                    }
                  />
                );
              })}
            </div>
          )}
        </LoginGate>
      )}

      <Modal open={posting} onClose={() => setPosting(false)} title="Mag-post ng bakante">
        {posting && (
          <RequireVerified feature="makapag-post ng bakante">
            <OpeningForm onDone={() => { setPosting(false); setTab("post"); }} />
          </RequireVerified>
        )}
      </Modal>
      <Modal open={!!open} onClose={() => setOpenId(null)} title="Detalye ng trabaho">
        {open && <OpeningDetail key={open.id} o={open} mine={appByOpening.get(open.id)} onClosed={() => setOpenId(null)} />}
      </Modal>
    </div>
  );
}
