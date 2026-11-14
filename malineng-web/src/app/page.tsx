"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import {
  Cake,
  ListChecks,
  Ambulance,
  ChevronRight,
  FileText,
  Megaphone,
  Phone,
  ShieldAlert,
  Siren,
  UserRound,
  HardHat,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/lib/useSettings";
import { useCollection } from "@/lib/useCollection";
import { APPOINTMENT_STATUS_LABEL, BARANGAY_CITY } from "@/lib/constants";
import { REQUEST_STATUS_LABEL, formatTime12 } from "@/lib/ambulance";
import { formatDate, sortNewest, telHref, todayISO, tsToMillis } from "@/lib/format";
import type { AmbulanceRequest, Appointment, InfraProject, Listing } from "@/lib/types";
import { ProgressBar, ProjectStatusPill, compareProjects } from "@/components/ProjectBits";
import { LinkButton, Modal, SectionTitle, Spinner } from "@/components/ui";
import { AdminShieldLink } from "@/components/AdminShieldLink";
import { PabatidBell } from "@/components/PabatidBell";
import { Avatar } from "@/components/Avatar";
import { LogoButton, LogoMark } from "@/components/BarangayLogo";
import { roleLabel } from "@/lib/activity";
import type { PublicStats } from "@/lib/stats";
import { useOnlineCount } from "@/lib/presence";
import { OnlineUsers } from "@/components/OnlineUsers";
import { MembersList } from "@/components/MembersList";
import { InstallBanner } from "@/components/InstallApp";
import { ServicesMenu } from "@/components/ServicesMenu";
import { SiteFooter } from "@/components/SiteFooter";
import { MgMark } from "@/components/MgMark";
import { WatchVideos } from "@/components/WatchVideos";
import { RaffleCard } from "@/components/RaffleCard";
import { useWebAccess } from "@/lib/webAccess";
import type { PrecinctMeta } from "@/lib/presinto";

type Tint = "green" | "gold" | "red" | "blue" | "purple" | "orange" | "teal" | "pink";
// Bank-app look: one calm light-blue circle for every service; red only for emergencies.
const UNIFORM = "bg-brand-light text-brand";
const TINT: Record<Tint, string> = {
  green: UNIFORM,
  gold: UNIFORM,
  red: "bg-red-50 text-red-600",
  blue: UNIFORM,
  purple: UNIFORM,
  orange: UNIFORM,
  teal: UNIFORM,
  pink: UNIFORM,
};

const projectsCollection = collection(db, "projects");

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Magandang umaga";
  if (h < 18) return "Magandang hapon";
  return "Magandang gabi";
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "M"
  );
}

/** "Balance card": the signed-in resident's live request statuses. */
function SummaryCard() {
  const { user, loading } = useAuth();
  const apptQ = useMemo(() => (user ? query(collection(db, "appointments"), where("userId", "==", user.uid)) : null), [user]);
  const ambQ = useMemo(() => (user ? query(collection(db, "ambulanceRequests"), where("userId", "==", user.uid)) : null), [user]);
  const listQ = useMemo(() => (user ? query(collection(db, "listings"), where("sellerId", "==", user.uid)) : null), [user]);
  const appts = useCollection<Appointment>(apptQ);
  const ambs = useCollection<AmbulanceRequest>(ambQ);
  const listings = useCollection<Listing>(listQ);

  if (loading) return <div className="h-36" />;

  if (!user) {
    return (
      <>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ang mga request mo</p>
        <p className="mt-0.5 text-[1.05rem] font-bold text-gray-900">Mag-login para ma-track ang clearance, ambulansya at paninda mo.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <LinkButton href="/login">Mag-login</LinkButton>
          <LinkButton href="/register" variant="soft">Mag-register</LinkButton>
        </div>
      </>
    );
  }

  const latestAppt = sortNewest(appts.data)[0];
  const activeAmb = sortNewest(ambs.data).find((r) => ["pending", "approved", "enroute"].includes(r.status));
  const pendingListings = listings.data.filter((l) => l.status === "pending").length;

  let headline = "Wala kang aktibong request ngayon.";
  if (activeAmb?.status === "enroute") headline = "🚑 Papunta na ang ambulansya";
  else if (latestAppt?.status === "ready") headline = `${latestAppt.service}: Ready na kunin`;
  else if (activeAmb) headline = `Ambulansya: ${REQUEST_STATUS_LABEL[activeAmb.status]}`;
  else if (latestAppt) headline = `${latestAppt.service}: ${APPOINTMENT_STATUS_LABEL[latestAppt.status].split(" —")[0]}`;

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ang mga request mo</p>
      <p className="mt-0.5 text-[1.05rem] font-bold text-gray-900">{headline}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {latestAppt && (
          <Link href="/appointment" className={`rounded-full px-2.5 py-1 text-xs font-semibold ${latestAppt.status === "ready" ? "bg-brand-light text-brand" : "bg-gold-light text-yellow-800"}`}>
            ● {latestAppt.service} · {formatDate(latestAppt.date)}
          </Link>
        )}
        {activeAmb && (
          <Link href="/ambulansya" className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            ● Ambulansya · {formatTime12(activeAmb.time)}
          </Link>
        )}
        {pendingListings > 0 && (
          <Link href="/account" className="rounded-full bg-gold-light px-2.5 py-1 text-xs font-semibold text-yellow-800">
            ● {pendingListings} paninda · naghihintay
          </Link>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <LinkButton href="/appointment?service=Barangay%20Clearance"><FileText className="h-4 w-4" /> Clearance</LinkButton>
        <LinkButton href="/appointment?service=Blotter" variant="soft"><ShieldAlert className="h-4 w-4" /> Mag-report</LinkButton>
      </div>
    </>
  );
}

export default function HomePage() {
  const { profile, isSuperAdmin, isVerified } = useAuth();
  const { settings, loading } = useSettings();
  const [hello, setHello] = useState("Magandang araw");
  const [stats, setStats] = useState<PublicStats | null>(null);
  const online = useOnlineCount();
  const [showOnline, setShowOnline] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  useEffect(
    () => onSnapshot(doc(db, "stats", "public"), (snap) => setStats(snap.exists() ? (snap.data() as PublicStats) : null), () => setStats(null)),
    [],
  );
  // Today's senior birthdays (published by officers from the Senior registry).
  const [birthdays, setBirthdays] = useState<string[]>([]);
  useEffect(
    () =>
      onSnapshot(
        doc(db, "stats", "birthdays"),
        (snap) => {
          const d = snap.data();
          setBirthdays(d && d.date === todayISO() && Array.isArray(d.seniors) ? (d.seniors as string[]) : []);
        },
        () => setBirthdays([]),
      ),
    [],
  );
  // Computed on the client: the static build would otherwise freeze the build-time hour.
  useEffect(() => setHello(greeting()), []);

  const punong = settings.officials.find((o) => /punong/i.test(o.position));
  const others = settings.officials.filter((o) => o !== punong);
  const firstName = profile?.fullName?.split(" ")[0];

  const emergencyRows = [
    ...[
      { name: "Tanod", number: settings.emergencyNumbers.tanod, icon: ShieldAlert, tint: "blue" as Tint },
      { name: "Health Center", number: settings.emergencyNumbers.healthCenter, icon: Ambulance, tint: "green" as Tint },
    ].filter((e) => e.number),
    ...settings.hotlines.slice(0, 3).map((h) => ({ name: h.name, number: h.numbers[0] ?? "", icon: Siren, tint: "red" as Tint })),
  ].filter((r) => r.number);

  // Web Access: Super Admin decides what residents see. Staff always see everything.
  const { access } = useWebAccess();
  const { isStaff } = useAuth();
  const [electionMeta, setElectionMeta] = useState<PrecinctMeta | null>(null);
  useEffect(
    () => onSnapshot(doc(db, "precinctMeta", "current"), (snap) => setElectionMeta(snap.exists() ? (snap.data() as PrecinctMeta) : null), () => setElectionMeta(null)),
    [],
  );
  const electionOn = access?.electionMode === true && !!electionMeta && electionMeta.count > 0;
  const projects = useCollection<InfraProject>(projectsCollection);
  const topProjects = useMemo(
    () => [...projects.data].sort(compareProjects).slice(0, 3),
    [projects.data],
  );

  return (
    <div>
      {/* Header: barangay identity, greeting, community numbers */}
      <section className="-mx-4 -mt-4 bg-gradient-to-br from-brand via-brand to-brand-deep px-4 pb-16 pt-4 text-white">
        <div className="flex items-center gap-2.5">
          <ServicesMenu pinPresinto={electionOn} />
          <LogoButton className="flex min-w-0 flex-1 items-center gap-2.5">
            <LogoMark size="h-9 w-9" textClass="text-sm" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[0.95rem] font-extrabold uppercase tracking-wide">Barangay Malineng</span>
              <span className="block truncate text-[0.7rem] text-white/70">{BARANGAY_CITY}</span>
            </span>
          </LogoButton>
          <PabatidBell />
          <AdminShieldLink />
        </div>

        <div className="mt-5 flex items-center gap-3.5">
          {profile ? (
            <Avatar name={profile.fullName} photo={profile.photoURL} size="h-14 w-14" textClass="text-lg" ring="ring-2 ring-gold/80" />
          ) : (
            <MgMark size="h-14 w-14" className="drop-shadow" />
          )}
          <div className="min-w-0 leading-tight">
            <p className="text-xs text-white/70">{hello},</p>
            <p className="truncate text-2xl font-extrabold tracking-tight">{firstName ?? "Kabarangay"}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[0.7rem] font-semibold text-white/80">
              {profile ? (
                <>
                  <span className="rounded-full bg-white/15 px-2 py-0.5">{isSuperAdmin ? "👑 " : ""}{roleLabel(profile.role, profile.position)}</span>
                  {isVerified && <span className="rounded-full bg-gold/90 px-2 py-0.5 text-brand-deep">✓ Verified</span>}
                </>
              ) : (
                <span className="rounded-full bg-white/15 px-2 py-0.5">Bisita</span>
              )}
            </p>
          </div>
        </div>

        {(online !== null || (stats && (stats.members > 0 || stats.verified > 0 || stats.households > 0))) && (
          <div className="mt-5 flex divide-x divide-white/15 rounded-2xl bg-white/10 py-2.5 ring-1 ring-white/15">
            {online !== null && (
              <button
                type="button"
                disabled={!isSuperAdmin}
                onClick={() => setShowOnline(true)}
                className="flex flex-1 flex-col items-center gap-0.5 px-1 enabled:active:opacity-70"
                title="Bukas ang website sa nakaraang 10 minuto"
                aria-label={isSuperAdmin ? `${online} online ngayon. Tingnan kung sino` : `${online} online ngayon`}
              >
                <span className="flex items-center gap-1.5 text-lg font-extrabold leading-none">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75 motion-reduce:hidden" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  {online.toLocaleString("en-PH")}
                </span>
                <span className="text-[0.65rem] font-medium uppercase tracking-wide text-white/70">Online</span>
              </button>
            )}
            {stats && stats.members > 0 && (
              <button
                type="button"
                disabled={!isSuperAdmin}
                onClick={() => setShowMembers(true)}
                className="flex flex-1 flex-col items-center gap-0.5 px-1 enabled:active:opacity-70"
                aria-label={isSuperAdmin ? `${stats.members} miyembro. Tingnan ang listahan` : `${stats.members} miyembro`}
              >
                <span className="text-lg font-extrabold leading-none">{stats.members.toLocaleString("en-PH")}</span>
                <span className="text-[0.65rem] font-medium uppercase tracking-wide text-white/70">Miyembro</span>
              </button>
            )}
            {stats && stats.verified > 0 && (
              <div className="flex flex-1 flex-col items-center gap-0.5 px-1">
                <span className="text-lg font-extrabold leading-none">{stats.verified.toLocaleString("en-PH")}</span>
                <span className="text-[0.65rem] font-medium uppercase tracking-wide text-white/70">Verified</span>
              </div>
            )}
            {stats && stats.households > 0 && (
              <div className="flex flex-1 flex-col items-center gap-0.5 px-1">
                <span className="text-lg font-extrabold leading-none">{stats.households.toLocaleString("en-PH")}</span>
                <span className="text-[0.65rem] font-medium uppercase tracking-wide text-white/70">Household</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Summary card */}
      <section className="relative z-10 -mt-10 rounded-2xl bg-white p-4 shadow-float">
        <SummaryCard />
      </section>

      <InstallBanner />

      {birthdays.length > 0 && (
        <section className="mt-3 flex items-center gap-3 rounded-2xl bg-gold-light p-3 text-yellow-900">
          <Cake className="h-6 w-6 shrink-0" aria-hidden />
          <p className="text-sm">
            <b>Maligayang kaarawan</b> sa ating mga lolo at lola: {birthdays.join(", ")}! 🎉
          </p>
        </section>
      )}

      {electionOn && (
        <Link href="/presinto" className="mt-3 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-brand to-brand-deep p-3.5 text-white shadow-card active:opacity-90">
          <ListChecks className="h-8 w-8 shrink-0" aria-hidden />
          <span className="min-w-0 text-sm">
            <b className="block text-base">Eleksyon{electionMeta?.electionDate ? `: ${electionMeta.electionDate}` : ""}</b>
            Alamin kung saang presinto ka boboto. Pindutin dito.
          </span>
          <ChevronRight className="ml-auto h-5 w-5 shrink-0" aria-hidden />
        </Link>
      )}

      {/* Raffle (only while the Developer has it on) */}
      <RaffleCard />

      {/* Every video of the barangay */}
      <WatchVideos />

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* Announcements carousel */}
          {settings.announcements.length > 0 && (
            <>
              <SectionTitle>Mga Anunsyo</SectionTitle>
              <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
                {settings.announcements.map((a, i) => (
                  <article
                    key={`${a.title}-${i}`}
                    className={`flex min-h-[7rem] w-[80%] max-w-sm shrink-0 snap-start flex-col justify-between rounded-2xl p-4 ${i % 2 === 0 ? "bg-gradient-to-br from-brand to-brand-deep text-white" : "bg-gradient-to-br from-gold to-gold-dark text-brand-deep"}`}
                  >
                    <p className="flex items-center gap-1 text-[0.7rem] font-bold uppercase tracking-wide opacity-80">
                      <Megaphone className="h-3.5 w-3.5" /> {a.date ? formatDate(a.date) : "Anunsyo"}
                    </p>
                    <p className="mt-1 font-bold leading-snug">{a.title}</p>
                    {a.body && <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs opacity-90">{a.body}</p>}
                  </article>
                ))}
              </div>
            </>
          )}

          {/* Officials */}
          {settings.officials.length > 0 && (
            <>
              <SectionTitle>Mga Opisyal</SectionTitle>
              <div className="overflow-hidden rounded-2xl bg-white shadow-card">
                {punong && (
                  <div className="flex items-center gap-3 border-b border-gray-100 p-3.5">
                    {punong.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={punong.photoURL} alt={punong.name} className="h-12 w-12 rounded-full object-cover ring-2 ring-gold" />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-sm font-bold text-gold">{initials(punong.name)}</span>
                    )}
                    <div>
                      <p className="font-bold">{punong.name}</p>
                      <p className="text-xs text-gray-500">{punong.position}</p>
                    </div>
                  </div>
                )}
                {others.length > 0 && (
                  <div className="no-scrollbar flex gap-4 overflow-x-auto p-3.5">
                    {others.map((o, i) => (
                      <div key={`${o.name}-${i}`} className="flex w-16 shrink-0 flex-col items-center text-center">
                        {o.photoURL ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={o.photoURL} alt={o.name} className="h-12 w-12 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand">
                            <UserRound className="h-5 w-5" />
                          </span>
                        )}
                        <p className="mt-1 line-clamp-2 text-[0.7rem] font-semibold leading-tight">{o.name}</p>
                        <p className="text-[0.65rem] text-gray-500">{o.position}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Transparency */}
          {topProjects.length > 0 ? (
            <>
              <SectionTitle
                action={
                  <Link href="/proyekto" className="flex items-center text-xs font-semibold text-brand">
                    Lahat ({projects.data.length}) <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                }
              >
                Transparency: Mga Proyekto
              </SectionTitle>
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-card">
                {topProjects.map((p) => {
                  const thumb = p.afterThumb || p.beforeThumb;
                  return (
                    <li key={p.id}>
                      <Link href={`/proyekto/item?id=${p.id}`} className="flex items-center gap-3 px-3 py-3 active:bg-gray-50">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-light text-yellow-700"><HardHat className="h-5 w-5" /></span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-semibold">{p.name}</p>
                            <ProjectStatusPill status={p.status} />
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex-1"><ProgressBar value={p.progress} /></div>
                            <span className="text-xs font-bold text-brand">{p.progress}%</span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : settings.projects.length > 0 ? (
            <>
              <SectionTitle>Transparency</SectionTitle>
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-card">
                {settings.projects.map((p, i) => {
                  const pct = Math.min(100, Math.max(0, Number(p.progress) || 0));
                  return (
                    <li key={`${p.name}-${i}`} className="px-4 py-3">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="font-semibold">{p.name}</span>
                        <span className="shrink-0 font-bold text-brand">{pct === 100 ? "✅ Tapos na" : `${pct}%`}</span>
                      </div>
                      <div className="mt-1.5"><ProgressBar value={pct} /></div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {/* Emergency */}
          <SectionTitle
            action={
              <Link href="/emergency" className="flex items-center text-xs font-semibold text-brand">
                Lahat <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            Emergency
          </SectionTitle>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-card">
            {emergencyRows.map((r, i) => (
              <li key={`${r.name}-${i}`} className="flex items-center gap-3 px-4 py-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TINT[r.tint]}`}>
                  <r.icon className="h-[1.1rem] w-[1.1rem]" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.name}</p>
                  <p className="text-xs tabular-nums text-gray-500">{r.number}</p>
                </div>
                <a href={telHref(r.number)} className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white active:bg-red-700" aria-label={`Tawagan ang ${r.name}`}>
                  <Phone className="h-3.5 w-3.5" /> Tawagan
                </a>
              </li>
            ))}
            <li>
              <a href="tel:911" className="flex items-center justify-between px-4 py-3 text-sm font-bold text-red-600">
                Nationwide Emergency
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" /> 911
                </span>
              </a>
            </li>
          </ul>
        </>
      )}

      <SiteFooter className="mt-8 pb-2" />

      {isSuperAdmin && (
        <Modal open={showOnline} onClose={() => setShowOnline(false)} title="Sino ang online">
          {showOnline && <OnlineUsers totalDevices={online} />}
        </Modal>
      )}
      {isSuperAdmin && (
        <Modal open={showMembers} onClose={() => setShowMembers(false)} title="Mga miyembro">
          {showMembers && <MembersList />}
        </Modal>
      )}
    </div>
  );
}
