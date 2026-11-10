"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import {
  Pill,
  HeartPulse,
  Cake,
  IdCard,
  FileWarning,
  Landmark,
  MapPinned,
  Package,
  Ambulance,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  FileText,
  HandCoins,
  LayoutGrid,
  Megaphone,
  MessagesSquare,
  Phone,
  Search,
  ShieldAlert,
  Siren,
  Store,
  Trophy,
  UserRound,
  Vote,
  Wrench,
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
import { ProgressBar, ProjectStatusPill, projectSortKey } from "@/components/ProjectBits";
import { LinkButton, Modal, SectionTitle, Spinner } from "@/components/ui";
import { AdminShieldLink } from "@/components/AdminShieldLink";
import { PabatidBell } from "@/components/PabatidBell";
import { Avatar } from "@/components/Avatar";
import { LogoButton, LogoMark } from "@/components/BarangayLogo";
import type { PublicStats } from "@/lib/stats";
import { useOnlineCount } from "@/lib/presence";
import { OnlineUsers } from "@/components/OnlineUsers";
import { MembersList } from "@/components/MembersList";
import { InstallBanner } from "@/components/InstallApp";

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

const SERVICES: { href: string; label: string; icon: typeof Store; tint: Tint }[] = [
  { href: "/tindahan", label: "Tindahan", icon: Store, tint: "gold" },
  { href: "/hiring", label: "Hiring", icon: Briefcase, tint: "green" },
  { href: "/ayuda", label: "Ayuda", icon: HandCoins, tint: "teal" },
  { href: "/appointment", label: "Appointment", icon: CalendarCheck, tint: "purple" },
  { href: "/ambulansya", label: "Ambulansya", icon: Ambulance, tint: "red" },
  { href: "/botika", label: "Botika", icon: Pill, tint: "green" },
  { href: "/hiraman", label: "Hiraman", icon: Package, tint: "blue" },
  { href: "/mapa", label: "Mapa", icon: MapPinned, tint: "blue" },
  { href: "/pabatid", label: "Pabatid", icon: Megaphone, tint: "blue" },
  { href: "/survey", label: "Survey", icon: Vote, tint: "blue" },
  { href: "/pondo", label: "Pondo", icon: Landmark, tint: "blue" },
  { href: "/barangay-id", label: "Barangay ID", icon: IdCard, tint: "blue" },
  { href: "/reklamo", label: "Reklamo", icon: FileWarning, tint: "blue" },
  { href: "/kalusugan", label: "Kalusugan", icon: HeartPulse, tint: "blue" },
  { href: "/liga", label: "Liga", icon: Trophy, tint: "blue" },
  { href: "/lost-found", label: "Lost & Found", icon: Search, tint: "pink" },
  { href: "/skills", label: "Skills", icon: Wrench, tint: "orange" },
  { href: "/proyekto", label: "Proyekto", icon: HardHat, tint: "gold" },
  // Shown after "Lahat":
  { href: "/board", label: "Board", icon: MessagesSquare, tint: "blue" },
  { href: "/register-event", label: "Magpa-rehistro", icon: ClipboardList, tint: "teal" },
  { href: "/events", label: "Events", icon: CalendarDays, tint: "blue" },
  { href: "/botohan", label: "Botohan", icon: Vote, tint: "purple" },
  { href: "/purok", label: "Purok Points", icon: Trophy, tint: "gold" },
  { href: "/emergency", label: "Emergency", icon: Siren, tint: "red" },
];
const PRIMARY_COUNT = 7;
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
  const { profile, isSuperAdmin } = useAuth();
  const { settings, loading } = useSettings();
  const [hello, setHello] = useState("Magandang araw");
  const [showAll, setShowAll] = useState(false);
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

  const services = showAll ? SERVICES : SERVICES.slice(0, PRIMARY_COUNT);
  const projects = useCollection<InfraProject>(projectsCollection);
  const topProjects = useMemo(
    () => [...projects.data].sort((a, b) => projectSortKey(a.status) - projectSortKey(b.status) || tsToMillis(b.updatedAt) - tsToMillis(a.updatedAt)).slice(0, 3),
    [projects.data],
  );

  return (
    <div>
      {/* Greeting header */}
      <section className="-mx-4 -mt-4 bg-gradient-to-br from-brand to-brand-deep px-4 pb-14 pt-5 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {profile ? (
              <Avatar name={profile.fullName} photo={profile.photoURL} size="h-10 w-10" ring="ring-2 ring-white/40" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-sm font-black text-brand-deep">M</span>
            )}
            <div className="leading-tight">
              <p className="text-xs text-white/75">{hello},</p>
              <p className="text-base font-bold">{firstName ? `${firstName} 👋` : "Kabarangay 👋"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PabatidBell />
            <AdminShieldLink />
          </div>
        </div>
        <LogoButton className="mt-3 flex items-center gap-2 text-xs text-white/80">
          <LogoMark size="h-6 w-6" textClass="text-[0.65rem]" />
          <span>Barangay Malineng · {BARANGAY_CITY}</span>
        </LogoButton>
        {(online !== null || (stats && stats.members > 0)) && (
          <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs font-semibold">
            {online !== null && (
              <button
                type="button"
                disabled={!isSuperAdmin}
                onClick={() => setShowOnline(true)}
                className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 enabled:active:bg-white/25"
                title="Bukas ang website sa nakaraang 5 minuto"
                aria-label={isSuperAdmin ? `${online} online ngayon. Tingnan kung sino` : `${online} online ngayon`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                {online.toLocaleString("en-PH")} online ngayon
                {isSuperAdmin && <ChevronRight className="-mr-1 h-3.5 w-3.5" aria-hidden />}
              </button>
            )}
            {stats && stats.members > 0 && (
              <button
                type="button"
                disabled={!isSuperAdmin}
                onClick={() => setShowMembers(true)}
                className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 enabled:active:bg-white/25"
                aria-label={isSuperAdmin ? `${stats.members} miyembro. Tingnan ang listahan` : `${stats.members} miyembro`}
              >
                👥 {stats.members.toLocaleString("en-PH")} miyembro
                {isSuperAdmin && <ChevronRight className="-mr-1 h-3.5 w-3.5" aria-hidden />}
              </button>
            )}
            {stats && stats.verified > 0 && <span className="rounded-full bg-white/15 px-2.5 py-1">✓ {stats.verified.toLocaleString("en-PH")} verified</span>}
            {stats && stats.households > 0 && <span className="rounded-full bg-white/15 px-2.5 py-1">🏠 {stats.households.toLocaleString("en-PH")} household</span>}
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

      {/* Services grid */}
      <SectionTitle>Mga Serbisyo</SectionTitle>
      <div className="grid grid-cols-4 gap-x-1 gap-y-4 rounded-2xl bg-white px-2 py-4 shadow-card">
        {services.map(({ href, label, icon: Icon, tint }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-1.5 text-center active:scale-95">
            <span className={`flex h-12 w-12 items-center justify-center rounded-full ${TINT[tint]}`}>
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-[0.75rem] font-medium leading-tight text-gray-700">{label}</span>
          </Link>
        ))}
        <button onClick={() => setShowAll((v) => !v)} className="flex flex-col items-center gap-1.5 text-center active:scale-95" aria-expanded={showAll}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand">
            {showAll ? <ChevronUp className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
          </span>
          <span className="text-[0.75rem] font-medium leading-tight text-gray-700">{showAll ? "Itago" : "Lahat"}</span>
        </button>
      </div>

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

      <p className="mt-8 text-center text-xs text-gray-400">© {new Date().getFullYear()} Barangay Malineng, {BARANGAY_CITY}</p>

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
