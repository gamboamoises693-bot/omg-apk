"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Ambulance,
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
  Megaphone,
  Menu,
  MapPinned,
  MessagesSquare,
  Package,
  Pill,
  Search,
  Siren,
  Store,
  Trophy,
  Vote,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
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
  { title: "Komunidad", hrefs: ["/pabatid", "/board", "/events", "/register-event", "/liga", "/purok", "/lost-found"] },
  { title: "Barangay", hrefs: ["/pondo", "/proyekto", "/mapa"] },
];

/** Hamburger button + dropdown with every service. `pinPresinto` moves Presinto to the top (Eleksyon mode). */
export function ServicesMenu({ pinPresinto, children }: { pinPresinto: boolean; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { isStaff } = useAuth();
  const { access } = useWebAccess();

  // Close after navigating, and on Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Eleksyon mode puts the election group first.
  const groups = pinPresinto ? [...GROUPS].sort((a, b) => Number(b.hrefs.includes("/presinto")) - Number(a.hrefs.includes("/presinto"))) : GROUPS;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Isara ang menu ng serbisyo" : "Buksan ang menu ng serbisyo"}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 active:bg-white/25"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Isara" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default bg-black/30" />
          <nav aria-label="Mga Serbisyo" className="fixed inset-x-3 top-16 z-50 mx-auto max-h-[78vh] max-w-lg overflow-y-auto rounded-3xl bg-white p-3 text-gray-900 shadow-2xl">
            {groups.map((g) => (
              <section key={g.title} className="mb-1">
                <p className="px-2 pb-1 pt-2 text-xs font-bold tracking-wide text-gray-500">{g.title.toUpperCase()}</p>
                <ul className="grid grid-cols-2 gap-1.5">
                  {g.hrefs.map((href) => {
                    const { label, icon: Icon, emergency } = BY_HREF[href];
                    const off = levelOf(access, href.slice(1)) === "off";
                    const locked = off && !isStaff;
                    return (
                      <li key={href}>
                        <Link href={href} className={`flex items-center gap-2.5 rounded-2xl px-2.5 py-2.5 active:bg-gray-100 ${locked ? "opacity-55" : ""}`}>
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${locked ? "bg-gray-100 text-gray-500" : emergency ? "bg-red-50 text-red-600" : "bg-brand-light text-brand"}`}>
                            {locked ? <Lock className="h-[1.1rem] w-[1.1rem]" aria-hidden /> : <Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden />}
                          </span>
                          <span className="min-w-0 text-sm font-semibold leading-tight">
                            {label}
                            {off && isStaff && <span className="block text-[0.6rem] font-bold text-gray-500">Off sa residente</span>}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {children}
          </nav>
        </>
      )}
    </>
  );
}
