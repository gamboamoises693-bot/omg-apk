"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Ambulance,
  ArrowLeft,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  FileWarning,
  HandCoins,
  HardHat,
  HeartPulse,
  IdCard,
  Landmark,
  ListChecks,
  Lock,
  LogIn,
  Megaphone,
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
      { href: "/board", label: "Board", icon: MessagesSquare },
      { href: "/register-event", label: "Magpa-rehistro", icon: ClipboardList },
      { href: "/events", label: "Events", icon: CalendarDays },
      { href: "/botohan", label: "Botohan", icon: Vote },
      { href: "/purok", label: "Purok Points", icon: Trophy },
      { href: "/emergency", label: "Emergency", icon: Siren, emergency: true },
    ] as Service[]
  ).map((s) => [s.href, s]),
);

/** Same idea as the admin menu: services sorted into groups so they are easy to find. */
const GROUPS: { title: string; hrefs: string[] }[] = [
  { title: "Emergency at kalusugan", hrefs: ["/emergency", "/ambulansya", "/botika", "/kalusugan"] },
  { title: "Dokumento at tulong", hrefs: ["/appointment", "/barangay-id", "/ayuda", "/reklamo", "/hiraman"] },
  { title: "Eleksyon at boto", hrefs: ["/presinto", "/botohan", "/survey"] },
  { title: "Negosyo at trabaho", hrefs: ["/tindahan", "/hiring", "/skills"] },
  { title: "Komunidad", hrefs: ["/chat", "/pabatid", "/board", "/events", "/register-event", "/liga", "/purok", "/lost-found"] },
  { title: "Barangay", hrefs: ["/pondo", "/proyekto", "/mapa"] },
];

/** Hamburger button + side drawer (same look as the admin menu) with every service, in groups. */
export function ServicesMenu({ pinPresinto }: { pinPresinto: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, profile, isStaff, isAdmin, isSuperAdmin } = useAuth();
  const { access } = useWebAccess();

  // Close after navigating.
  useEffect(() => setOpen(false), [pathname]);
  // Lock page scroll and close on Escape while the drawer is open.
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

  // Eleksyon mode puts the election group first.
  const groups = pinPresinto ? [...GROUPS].sort((a, b) => Number(b.hrefs.includes("/presinto")) - Number(a.hrefs.includes("/presinto"))) : GROUPS;

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

      {open && (
        <div className="fixed inset-0 z-50 text-gray-900" role="dialog" aria-modal="true" aria-label="Menu ng serbisyo">
          <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-black/40" onClick={() => setOpen(false)} aria-label="Isara ang menu" tabIndex={-1} />
          <nav className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-white shadow-2xl motion-safe:animate-drawer-in">
            <div className="flex items-center gap-3 bg-gradient-to-br from-brand to-brand-deep px-4 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
              {user && profile ? (
                <Avatar name={profile.fullName} photo={profile.photoURL} size="h-11 w-11" textClass="text-base" ring="ring-2 ring-white/40" />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold text-base font-black text-brand-deep">M</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{user && profile ? profile.fullName : "Kabarangay"}</p>
                <p className="truncate text-xs text-white/85">
                  {user && profile ? `${isSuperAdmin ? "👑 " : ""}${roleLabel(profile.role, profile.position)}` : "Bisita · Barangay Malineng"}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1.5 active:bg-white/15" aria-label="Isara">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-3">
              {groups.map((g) => (
                <div key={g.title}>
                  <p className="px-2 pb-1 pt-3 text-[0.68rem] font-bold uppercase tracking-wider text-gray-500">{g.title}</p>
                  {g.hrefs.map((href) => {
                    const { label, icon: Icon, emergency } = BY_HREF[href];
                    const on = pathname.replace(/\/$/, "") === href;
                    const off = levelOf(access, href.slice(1)) === "off";
                    const locked = off && !isStaff;
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left ${on ? "bg-gold-light" : "active:bg-gray-50"} ${locked ? "opacity-55" : ""}`}
                        aria-current={on ? "page" : undefined}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${locked ? "bg-gray-100 text-gray-500" : emergency ? "bg-red-50 text-red-600" : "bg-brand-light text-brand"}`}>
                          {locked ? <Lock className="h-[1.1rem] w-[1.1rem]" aria-hidden /> : <Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden />}
                        </span>
                        <span className={`min-w-0 flex-1 truncate text-sm ${on ? "font-bold" : "font-medium"} text-gray-800`}>{label}</span>
                        {off && isStaff && <span className="shrink-0 rounded-full bg-gray-200 px-1.5 text-[0.6rem] font-bold text-gray-600">Off sa residente</span>}
                        {locked && <span className="shrink-0 text-[0.65rem] font-semibold text-gray-500">Malapit na</span>}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm">
              <Link href="/" className="flex items-center gap-1 font-semibold text-brand">
                <ArrowLeft className="h-4 w-4" /> Bumalik sa Home
              </Link>
              {user ? (
                isAdmin ? (
                  <Link href="/admin" className="flex items-center gap-1 text-xs font-semibold text-brand">
                    <ShieldCheck className="h-4 w-4" /> Admin
                  </Link>
                ) : (
                  <Link href="/account" className="flex items-center gap-1 text-xs font-semibold text-brand">
                    <UserCircle className="h-4 w-4" /> Account ko
                  </Link>
                )
              ) : (
                <Link href="/login" className="flex items-center gap-1 text-xs font-semibold text-brand">
                  <LogIn className="h-4 w-4" /> Mag-login
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
