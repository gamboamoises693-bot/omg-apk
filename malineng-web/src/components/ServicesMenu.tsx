"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Ambulance,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  FileWarning,
  HandCoins,
  HelpCircle,
  Gavel,
  Gift,
  HardHat,
  HeartPulse,
  IdCard,
  Landmark,
  ListChecks,
  Lock,
  Users,
  FileText,
  Building2,
  LogIn,
  LogOut,
  Megaphone,
  ChevronDown,
  Home,
  Menu,
  MessageCircle,
  MapPinned,
  MessagesSquare,
  Package,
  Pill,
  Search,
  ShieldCheck,
  Siren,
  Store,
  Trophy,
  UserCircle,
  Vote,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { roleLabel } from "@/lib/activity";
import { Avatar } from "@/components/Avatar";
import { levelOf, useWebAccess } from "@/lib/webAccess";
import { useXmas } from "@/lib/raffle";
import { GlassSidebar, type SideAction, type SideGroup, type SideItem } from "@/components/GlassSidebar";
import { useLatestNotice } from "@/lib/useLatestNotice";

interface Service {
  href: string;
  label: string;
  icon: LucideIcon;
  emergency?: boolean;
}

const BY_HREF: Record<string, Service> = Object.fromEntries(
  (
    [
      { href: "/chat", label: "Chat", icon: MessageCircle },
      { href: "/presinto", label: "Presinto", icon: ListChecks },
      { href: "/tindahan", label: "Tindahan", icon: Store },
      { href: "/hiring", label: "Hiring", icon: Briefcase },
      { href: "/ayuda", label: "Ayuda", icon: HandCoins },
      { href: "/appointment", label: "Appointment", icon: CalendarCheck },
      { href: "/ambulansya", label: "Ambulansya", icon: Ambulance, emergency: true },
      { href: "/botika", label: "Botika", icon: Pill },
      { href: "/hiraman", label: "Hiraman", icon: Package },
      { href: "/mapa", label: "Mapa", icon: MapPinned },
      { href: "/pabatid", label: "Pabatid", icon: Megaphone },
      { href: "/survey", label: "Survey", icon: Vote },
      { href: "/pondo", label: "Pondo", icon: Landmark },
      { href: "/barangay-id", label: "Barangay ID", icon: IdCard },
      { href: "/reklamo", label: "Reklamo", icon: FileWarning },
      { href: "/kalusugan", label: "Kalusugan", icon: HeartPulse },
      { href: "/liga", label: "Liga", icon: Trophy },
      { href: "/lost-found", label: "Lost & Found", icon: Search },
      { href: "/skills", label: "Skills", icon: Wrench },
      { href: "/proyekto", label: "Proyekto", icon: HardHat },
      { href: "/desisyon", label: "Mga Desisyon", icon: Gavel },
      { href: "/raffle", label: "Raffle", icon: Gift },
      { href: "/board", label: "Board", icon: MessagesSquare },
      { href: "/register-event", label: "Magpa-rehistro", icon: ClipboardList },
      { href: "/events", label: "Events", icon: CalendarDays },
      { href: "/botohan", label: "Botohan", icon: Vote },
      { href: "/purok", label: "Purok Points", icon: Trophy },
      { href: "/emergency", label: "Emergency", icon: Siren, emergency: true },
      { href: "/gabay", label: "Paano gamitin", icon: HelpCircle },
    ] as Service[]
  ).map((s) => [s.href, s]),
);

interface Section {
  /** Sub-heading inside a category. Categories with a single section show no sub-heading. */
  title?: string;
  hrefs: string[];
}

interface Category {
  id: string;
  /** Short label under the rail icon. */
  label: string;
  icon: LucideIcon;
  emergency?: boolean;
  sections: Section[];
}

/** Rail on the left (one button per category) + panel on the right (search, quick links, services). */
const CATEGORIES: Category[] = [
  { id: "emergency", label: "Emergency", icon: Siren, emergency: true, sections: [{ hrefs: ["/emergency", "/ambulansya", "/botika", "/kalusugan"] }] },
  { id: "papeles", label: "Papeles", icon: FileText, sections: [{ hrefs: ["/appointment", "/barangay-id", "/ayuda", "/reklamo", "/hiraman"] }] },
  { id: "eleksyon", label: "Eleksyon", icon: Vote, sections: [{ hrefs: ["/presinto", "/botohan", "/survey"] }] },
  { id: "negosyo", label: "Negosyo", icon: Store, sections: [{ hrefs: ["/tindahan", "/hiring", "/skills"] }] },
  {
    id: "komunidad",
    label: "Komunidad",
    icon: Users,
    sections: [
      { title: "Usapan", hrefs: ["/chat", "/board", "/pabatid"] },
      { title: "Okasyon", hrefs: ["/events", "/raffle", "/register-event"] },
      { title: "Laro at iba pa", hrefs: ["/liga", "/purok", "/lost-found"] },
    ],
  },
  { id: "barangay", label: "Barangay", icon: Building2, sections: [{ hrefs: ["/pondo", "/proyekto", "/desisyon", "/mapa"] }] },
  { id: "tulong", label: "Tulong", icon: HelpCircle, sections: [{ hrefs: ["/gabay"] }] },
];

/** Shortcuts shown as chips above the list. */
const QUICK_HREFS = ["/chat", "/raffle", "/appointment"];

const categoryOf = (pathname: string) => {
  const path = pathname.replace(/\/$/, "");
  return CATEGORIES.find((c) => c.sections.some((s) => s.hrefs.includes(path)))?.id;
};

/** Hamburger button + the curved glass sidebar (groups open like an accordion). */
export function ServicesMenu({ pinPresinto }: { pinPresinto: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, isStaff, isAdmin, logout } = useAuth();
  const { access } = useWebAccess();
  const xmas = useXmas();
  const notice = useLatestNotice();

  // Close after navigating.
  useEffect(() => setOpen(false), [pathname]);

  const currentPath = pathname.replace(/\/$/, "");
  // Eleksyon mode puts the election group first.
  const ordered = pinPresinto ? [...CATEGORIES].sort((a, b) => Number(b.id === "eleksyon") - Number(a.id === "eleksyon")) : CATEGORIES;

  const toItem = (href: string, heading?: string): SideItem => {
    const { label, emergency } = BY_HREF[href];
    const off = levelOf(access, href.slice(1)) === "off";
    return {
      key: href,
      label,
      href,
      emergency,
      heading,
      locked: off && !isStaff,
      note: off && isStaff ? "Off sa residente" : off ? "Malapit na" : undefined,
    };
  };
  const groups: SideGroup[] = ordered.map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    emergency: c.emergency,
    items: c.sections.flatMap((sec) => sec.hrefs.map((h, idx) => toItem(h, idx === 0 ? sec.title : undefined))),
  }));
  const actions: SideAction[] = [
    { key: "home", label: "Home", icon: Home, href: "/" },
    user
      ? { key: "me", label: isAdmin ? "Admin" : "Account ko", icon: isAdmin ? ShieldCheck : UserCircle, href: isAdmin ? "/admin" : "/account" }
      : { key: "login", label: "Mag-login", icon: LogIn, href: "/login" },
    ...(user
      ? [
          {
            key: "logout",
            label: "Mag-logout",
            icon: LogOut,
            onClick: async () => {
              setOpen(false);
              await logout();
              router.replace("/login");
            },
          } as SideAction,
        ]
      : []),
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label="Buksan ang menu ng serbisyo"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 active:bg-white/25"
      >
        <Menu className="h-5 w-5" />
      </button>

      <GlassSidebar
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel="Menu ng serbisyo"
        user={user && profile ? { name: profile.fullName, role: roleLabel(profile.role, profile.position), photo: profile.photoURL, href: "/account", online: true } : null}
        groups={groups}
        current={currentPath}
        defaultGroupId={categoryOf(pathname) ?? (pinPresinto ? "eleksyon" : CATEGORIES[0].id)}
        quick={QUICK_HREFS.map((h) => toItem(h))}
        notice={notice}
        actions={actions}
        footer={xmas ? <p className="text-center text-xs font-bold tracking-wide text-[#f6d587]">Maligayang Pasko, Malineng!</p> : null}
      />
    </>
  );
}
