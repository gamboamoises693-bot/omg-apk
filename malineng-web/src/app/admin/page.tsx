"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Pill,
  HeartPulse,
  FileWarning,
  HeartHandshake,
  Megaphone,
  Landmark,
  CopyCheck,
  MapPinned,
  Package,
  Ambulance,
  BadgeCheck,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Crown,
  FileBarChart,
  Gavel,
  Gift,
  HandCoins,
  ScanLine,
  HardHat,
  ScrollText,
  Settings as SettingsIcon,
  Trophy,
  Users,
  Vote,
  Clapperboard,
  Globe,
  MessageCircle,
  ListChecks,
  type LucideIcon,
  UserCog,
  LifeBuoy,
  UserPlus,
  Printer,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAdminPending } from "@/context/AdminPendingContext";
import { ALERTS_EVENT, getAlertsEnabled } from "@/lib/alerts";
import { roleLabel } from "@/lib/activity";
import { AdminGate } from "@/components/LoginGate";
import { AlertsSettingsCard } from "@/components/admin/AlertsSettingsCard";
import { AdminModeration } from "@/components/admin/AdminModeration";
import { AdminAppointments } from "@/components/admin/AdminAppointments";
import { AdminAyuda } from "@/components/admin/AdminAyuda";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { AdminEvents } from "@/components/admin/AdminEvents";
import { AdminPolls } from "@/components/admin/AdminPolls";
import { AdminPurok } from "@/components/admin/AdminPurok";
import { AdminRegistrations } from "@/components/admin/AdminRegistrations";
import { AdminAmbulance } from "@/components/admin/AdminAmbulance";
import { AdminVerification } from "@/components/admin/AdminVerification";
import { AdminProfileChanges } from "@/components/admin/AdminProfileChanges";
import { AdminHelpInbox } from "@/components/admin/AdminHelpInbox";
import { AdminHallRegister } from "@/components/admin/AdminHallRegister";
import { AdminIdPrint } from "@/components/admin/AdminIdPrint";
import { AdminHouseholds } from "@/components/admin/AdminHouseholds";
import { AdminReport } from "@/components/admin/AdminReport";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminNav, type NavCategory, type NavItem } from "@/components/admin/AdminNav";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminActivity } from "@/components/admin/AdminActivity";
import { AdminProjects } from "@/components/admin/AdminProjects";
import { AdminHiraman } from "@/components/admin/AdminHiraman";
import { AdminMapa } from "@/components/admin/AdminMapa";
import { AdminDuplicates } from "@/components/admin/AdminDuplicates";
import { AdminBlotter } from "@/components/admin/AdminBlotter";
import { AdminSektor } from "@/components/admin/AdminSektor";
import { AdminPresinto } from "@/components/admin/AdminPresinto";
import { AdminWebAccess } from "@/components/admin/AdminWebAccess";
import { AdminVideos } from "@/components/admin/AdminVideos";
import { AdminChat } from "@/components/admin/AdminChat";
import { AdminApprovals } from "@/components/admin/AdminApprovals";
import { AdminRaffle } from "@/components/admin/AdminRaffle";
import { AdminRaffleDonations } from "@/components/admin/AdminRaffleDonations";
import { AdminRaffleVerify } from "@/components/admin/AdminRaffleVerify";
import { DevInbox, useDevInboxCount } from "@/components/DevInbox";
import { HowToButton } from "@/components/HowTo";
import { AdminDecisions } from "@/components/admin/AdminDecisions";
import { useXmas } from "@/lib/raffle";
import { AdminAyudaBatches } from "@/components/admin/AdminAyudaBatches";

interface Section {
  key: string;
  label: string;
  icon: LucideIcon;
  Component: ComponentType;
  /** Officers only: Kapitan, Secretary and Super Admin (Hiraman, Blotter, Sektor). */
  borrowOnly?: boolean;
  /** Also open to every other admin (not BHW) because they take part in the approval steps (Hiraman). */
  approver?: boolean;
}

interface Group {
  title: string;
  /** Super Admin only (also enforced server-side by firestore.rules). */
  superOnly?: boolean;
  sections: Section[];
}

const GROUPS: Group[] = [
  {
    title: "Kailangang aksyunan",
    sections: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, Component: AdminDashboard, borrowOnly: true },
      { key: "approve", label: "I-approve", icon: ClipboardCheck, Component: AdminModeration },
      { key: "verification", label: "Verification", icon: BadgeCheck, Component: AdminVerification },
      { key: "profilechange", label: "Pagbabago sa Profile", icon: UserCog, Component: AdminProfileChanges },
      { key: "helpsetup", label: "Tulong sa Setup", icon: LifeBuoy, Component: AdminHelpInbox },
      { key: "hallregister", label: "Rehistro sa Hall", icon: UserPlus, Component: AdminHallRegister },
      { key: "ambulansya", label: "Ambulansya", icon: Ambulance, Component: AdminAmbulance },
      { key: "appointments", label: "Appointments", icon: CalendarCheck, Component: AdminAppointments },
      { key: "hiraman", label: "Hiraman", icon: Package, Component: AdminHiraman, borrowOnly: true, approver: true },
      { key: "ayudabatch", label: "Ayuda: Batch", icon: HandCoins, Component: AdminAyudaBatches, borrowOnly: true, approver: true },
      { key: "raffleverify", label: "Raffle: I-verify ang nanalo", icon: ScanLine, Component: AdminRaffleVerify, borrowOnly: true, approver: true },
      { key: "rafflepledge", label: "Raffle: Donasyon", icon: Gift, Component: AdminRaffleDonations, borrowOnly: true, approver: true },
      { key: "desisyon", label: "Mahalagang desisyon", icon: Gavel, Component: AdminDecisions, borrowOnly: true, approver: true },
      { key: "blotter", label: "Blotter / Reklamo", icon: FileWarning, Component: AdminBlotter, borrowOnly: true },
    ],
  },
  {
    title: "Mga residente",
    sections: [
      { key: "ayuda", label: "Ayuda", icon: HandCoins, Component: AdminAyuda },
      { key: "households", label: "Households", icon: Users, Component: AdminHouseholds },
      { key: "sektor", label: "Senior / PWD / Solo", icon: HeartHandshake, Component: AdminSektor, borrowOnly: true },
      { key: "registrations", label: "Registrations", icon: ClipboardList, Component: AdminRegistrations },
      { key: "idprint", label: "I-print ang mga ID", icon: Printer, Component: AdminIdPrint },
    ],
  },
  {
    title: "Website at komunidad",
    sections: [
      { key: "proyekto", label: "Proyekto", icon: HardHat, Component: AdminProjects },
      { key: "mapa", label: "Mapa", icon: MapPinned, Component: AdminMapa },
      { key: "events", label: "Events", icon: CalendarDays, Component: AdminEvents },
      { key: "polls", label: "Botohan", icon: Vote, Component: AdminPolls },
      { key: "chat", label: "Chat Moderation", icon: MessageCircle, Component: AdminChat, borrowOnly: true },
      { key: "presinto", label: "Presinto", icon: ListChecks, Component: AdminPresinto, borrowOnly: true },
      { key: "purok", label: "Purok Points", icon: Trophy, Component: AdminPurok },
      { key: "report", label: "Report", icon: FileBarChart, Component: AdminReport },
      { key: "settings", label: "Settings", icon: SettingsIcon, Component: AdminSettings },
    ],
  },
  {
    title: "Super Admin lang",
    superOnly: true,
    sections: [
      { key: "devchat", label: "Mensahe sa Developer", icon: MessageCircle, Component: DevInbox },
      { key: "users", label: "Users at Roles", icon: Crown, Component: AdminUsers },
      { key: "approvals", label: "Approval", icon: ClipboardCheck, Component: AdminApprovals },
      { key: "raffle", label: "Raffle", icon: Gift, Component: AdminRaffle },
      { key: "videos", label: "Videos", icon: Clapperboard, Component: AdminVideos },
      { key: "webaccess", label: "Web Access", icon: Globe, Component: AdminWebAccess },
      { key: "doble", label: "Posibleng Doble", icon: CopyCheck, Component: AdminDuplicates },
      { key: "activity", label: "Activity Log", icon: ScrollText, Component: AdminActivity },
    ],
  },
];

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[0.7rem] font-black text-white">{n > 99 ? "99+" : n}</span>;
}

export default function AdminPage() {
  const { isSuperAdmin, isAdmin, canBotika, canBorrowAdmin, isOfficer, canLiga, profile } = useAuth();
  const xmas = useXmas();
  // People waiting for the Developer's answer (shown on the "Mensahe sa Developer" menu item).
  const devWaiting = useDevInboxCount(isSuperAdmin);
  const { byTab, total } = useAdminPending();
  const groups = useMemo(
    () =>
      GROUPS.filter((g) => !g.superOnly || isSuperAdmin).map((g) => ({ ...g, sections: g.sections.filter((s) => !s.borrowOnly || canBorrowAdmin || (s.approver && isAdmin)) })),
    [isSuperAdmin, canBorrowAdmin, isAdmin],
  );
  const sections = useMemo(() => groups.flatMap((g) => g.sections), [groups]);
  const { byTab: pendingByTab } = useAdminPending();
  // Rail categories of the menu: the section groups, plus an "Opisina" group of shortcuts to other pages.
  const categories = useMemo<NavCategory[]>(() => {
    const toItems = (list: Section[]): NavItem[] => list.map((x) => ({ key: x.key, label: x.label, icon: x.icon, badge: x.key === "devchat" ? devWaiting : pendingByTab[x.key] }));
    const byTitle = (t: string) => groups.find((g) => g.title === t);
    const links: NavItem[] = [];
    if (canBotika) links.push({ key: "l-botika", label: "Botika (BHW)", icon: Pill, href: "/botika/manage" }, { key: "l-kalusugan", label: "Bakuna at Buntis", icon: HeartPulse, href: "/kalusugan" });
    if (canLiga) links.push({ key: "l-liga", label: "Liga (score at teams)", icon: Trophy, href: "/liga" });
    if (isOfficer) links.push({ key: "l-pabatid", label: "Pabatid (magpadala)", icon: Megaphone, href: "/pabatid" }, { key: "l-survey", label: "Survey at Suhestiyon", icon: Vote, href: "/survey" }, { key: "l-pondo", label: "Pondo / Transparency", icon: Landmark, href: "/pondo" });
    const out: NavCategory[] = [];
    const add = (id: string, label: string, icon: LucideIcon, items: NavItem[]) => items.length > 0 && out.push({ id, label, icon, items });
    add("aksyon", "Aksyon", ClipboardCheck, toItems(byTitle("Kailangang aksyunan")?.sections ?? []));
    add("residente", "Residente", Users, toItems(byTitle("Mga residente")?.sections ?? []));
    add("website", "Komunidad", Globe, toItems(byTitle("Website at komunidad")?.sections ?? []));
    add("opisina", "Opisina", Landmark, links);
    add("dev", "Developer", Crown, toItems(byTitle("Super Admin lang")?.sections ?? []));
    return out;
  }, [groups, devWaiting, pendingByTab, canBotika, canLiga, isOfficer]);
  // Kapitan, Secretary and the Developer open on the Dashboard; the others (no such section) fall back to the first one.
  const [current, setCurrent] = useState("dashboard");
  const [open, setOpen] = useState(false);
  const [alertsOn, setAlertsOn] = useState(false);

  // Deep link: /admin/#ambulansya (notifications, shield badge, Settings links).
  useEffect(() => {
    const fromHash = () => {
      const key = window.location.hash.slice(1);
      if (sections.some((s) => s.key === key)) setCurrent(key);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [sections]);

  useEffect(() => {
    const sync = () => setAlertsOn(getAlertsEnabled());
    sync();
    window.addEventListener(ALERTS_EVENT, sync);
    return () => window.removeEventListener(ALERTS_EVENT, sync);
  }, []);

  // Drawer: lock page scroll and close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const choose = (key: string) => {
    setCurrent(key);
    setOpen(false);
    history.replaceState(null, "", `#${key}`);
    window.scrollTo({ top: 0 });
  };

  const active = sections.find((s) => s.key === current) ?? sections[0];
  const ActiveIcon = active.icon;
  const Active = active.Component;

  return (
    <AdminGate>
      {/* Header: hamburger + current section */}
      <div className="sticky top-[52px] z-30 -mx-4 -mt-4 mb-4 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-2.5">
        <button
          onClick={() => setOpen(true)}
          className="relative flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-[5px] rounded-xl border border-gray-200 bg-white active:bg-gray-50"
          aria-label={total ? `Buksan ang admin menu, ${total} naghihintay` : "Buksan ang admin menu"}
          aria-expanded={open}
        >
          <span className="h-0.5 w-[18px] rounded bg-gray-800" />
          <span className="h-0.5 w-[18px] rounded bg-gray-800" />
          <span className="h-0.5 w-[18px] rounded bg-gray-800" />
          {total > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[10px] font-black text-white">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.7rem] font-semibold text-gray-500">
            Admin Dashboard{profile ? ` · ${profile.fullName.split(" ")[0]} · ${roleLabel(profile.role, profile.position)}` : ""}
          </p>
          <p className="flex items-center gap-1.5 text-base font-extrabold text-brand-deep">
            <ActiveIcon className="h-4 w-4 text-brand" aria-hidden /> {active.label}
            <Badge n={active.key === "devchat" ? devWaiting : byTab[active.key]} />
          </p>
        </div>
        {/* A how-to for this section, if it has one (src/data/guides.json: "admin-<section>"). */}
        <HowToButton id={`admin-${active.key}`} />
      </div>

      {active.key === "approve" && (
        <div className="mb-4">
          <AlertsSettingsCard />
        </div>
      )}
      <Active />

      <AdminNav
        open={open}
        onClose={() => setOpen(false)}
        categories={categories}
        current={active.key}
        onChoose={choose}
        alertsOn={alertsOn}
        onAlerts={() => choose("approve")}
        xmas={xmas}
      />
    </AdminGate>
  );
}
