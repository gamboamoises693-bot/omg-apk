"use client";

import { useEffect, useState } from "react";
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
import { XmasStar } from "@/components/Xmas";

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

/** Hamburger button + side drawer: category rail on the left, search + services panel on the right. */
export function ServicesMenu({ pinPresinto }: { pinPresinto: boolean }) {
  const [open, setOpen] = useState(false);
  const [catId, setCatId] = useState<string>(CATEGORIES[0].id);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const pathname = usePathname();
  const { user, profile, isStaff, isAdmin, isSuperAdmin } = useAuth();
  const { access } = useWebAccess();
  const xmas = useXmas();

  // Close after navigating.
  useEffect(() => setOpen(false), [pathname]);
  // On every open: start on the category of the current page (Eleksyon first in election mode), with a clean search.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCatId(categoryOf(pathname) ?? (pinPresinto ? "eleksyon" : CATEGORIES[0].id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
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

  // Eleksyon mode puts the election category first in the rail.
  const categories = pinPresinto ? [...CATEGORIES].sort((a, b) => Number(b.id === "eleksyon") - Number(a.id === "eleksyon")) : CATEGORIES;
  const category = categories.find((c) => c.id === catId) ?? categories[0];
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const allHrefs = CATEGORIES.flatMap((c) => c.sections.flatMap((s) => s.hrefs));
  const results = searching ? allHrefs.filter((h) => BY_HREF[h].label.toLowerCase().includes(q)) : [];
  const count = category.sections.reduce((n, s) => n + s.hrefs.length, 0);
  const currentPath = pathname.replace(/\/$/, "");

  /** One service row: icon-less text row with a gold rail when it is the current page. */
  const renderRow = (href: string, indent: boolean) => {
    const { label, emergency } = BY_HREF[href];
    const on = currentPath === href;
    const off = levelOf(access, href.slice(1)) === "off";
    const locked = off && !isStaff;
    return (
      <Link
        key={href}
        href={href}
        aria-current={on ? "page" : undefined}
        className={`relative flex min-h-[2.75rem] items-center gap-2 rounded-xl px-3 text-[0.95rem] ${indent ? "ml-6" : ""} ${on ? "bg-gold-light font-bold" : "active:bg-brand-light"} ${locked ? "opacity-55" : ""} ${emergency ? "text-red-700" : "text-gray-800"}`}
      >
        {on && <span className="absolute inset-y-2.5 left-0 w-1 rounded-r bg-gold" aria-hidden />}
        {locked && <Lock className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {off && isStaff && <span className="shrink-0 rounded-full bg-gray-200 px-1.5 text-[0.6rem] font-bold text-gray-600">Off sa residente</span>}
        {locked && <span className="shrink-0 text-[0.65rem] font-semibold text-gray-500">Malapit na</span>}
      </Link>
    );
  };

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
          <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-black/45" onClick={() => setOpen(false)} aria-label="Isara ang menu" tabIndex={-1} />
          <nav className="absolute inset-y-0 left-0 flex w-[92%] max-w-sm bg-surface shadow-2xl motion-safe:animate-drawer-in">
            {/* Rail: profile, categories, Home and Account */}
            <div className="flex w-[4.75rem] shrink-0 flex-col items-center bg-brand-deep pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="h-1 w-full bg-gradient-to-r from-[#0038A8] from-50% to-[#CE1126] to-50%" aria-hidden />
              <Link href={user ? "/account" : "/login"} aria-label={user && profile ? `${profile.fullName} (${roleLabel(profile.role, profile.position)})` : "Mag-login"} className="mb-3 mt-[max(0.75rem,env(safe-area-inset-top))]">
                {user && profile ? (
                  <Avatar name={profile.fullName} photo={profile.photoURL} size="h-12 w-12" textClass="text-base" ring="ring-2 ring-white/30" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white"><LogIn className="h-5 w-5" aria-hidden /></span>
                )}
              </Link>
              <div className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-1">
                {categories.map((c) => {
                  const on = c.id === category.id;
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setCatId(c.id); setQuery(""); }}
                      aria-pressed={on}
                      className={`flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 rounded-2xl text-[0.65rem] ${on ? "bg-gold font-extrabold text-brand-deep" : c.emergency ? "bg-red-900/60 font-semibold text-white" : "font-semibold text-blue-100 active:bg-white/10"}`}
                    >
                      <Icon className="h-6 w-6" aria-hidden />
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <Link href="/" className="flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-1 text-[0.65rem] font-semibold text-blue-100">
                <Home className="h-6 w-6" aria-hidden />
                Home
              </Link>
              {user ? (
                <Link href={isAdmin ? "/admin" : "/account"} className="flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-1 text-[0.65rem] font-semibold text-blue-100">
                  {isAdmin ? <ShieldCheck className="h-6 w-6" aria-hidden /> : <UserCircle className="h-6 w-6" aria-hidden />}
                  {isAdmin ? "Admin" : "Account ko"}
                </Link>
              ) : (
                <Link href="/login" className="flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-1 text-[0.65rem] font-semibold text-blue-100">
                  <LogIn className="h-6 w-6" aria-hidden />
                  Mag-login
                </Link>
              )}
            </div>

            {/* Panel: title, search, quick links, services */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-gray-600">{searching ? "Resulta" : category.label}</p>
                  <p className="truncate text-sm text-gray-600">
                    {searching ? `${results.length} nakita` : `${count} serbisyo`}
                    {user && profile ? ` · ${isSuperAdmin ? "👑 " : ""}${roleLabel(profile.role, profile.position)}` : " · Bisita"}
                  </p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="-mr-2 -mt-1 flex h-11 w-11 items-center justify-center rounded-full active:bg-brand-light" aria-label="Isara">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-4 pt-3">
                <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-gray-300 bg-white px-3 focus-within:border-brand">
                  <Search className="h-5 w-5 shrink-0 text-gray-600" aria-hidden />
                  <span className="sr-only">Maghanap ng serbisyo</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Maghanap sa lahat…"
                    className="min-w-0 flex-1 bg-transparent text-[0.95rem] outline-none"
                  />
                </label>
              </div>

              <div className="flex-1 overflow-y-auto px-3 pb-3">
                {searching ? (
                  <div className="pt-3">
                    {results.length === 0 ? <p className="px-3 py-6 text-center text-sm text-gray-600">Walang nakita. Subukan ang ibang salita.</p> : results.map((h) => renderRow(h, false))}
                  </div>
                ) : (
                  <>
                    <p className="px-1 pt-4 text-xs font-extrabold uppercase tracking-widest text-gray-600">Madalas gamitin</p>
                    <div className="flex flex-wrap gap-2 px-1 pt-2">
                      {QUICK_HREFS.map((h) => (
                        <Link key={h} href={h} className="flex min-h-9 items-center rounded-full bg-brand-light px-3.5 text-[0.8rem] font-bold text-brand-dark active:bg-blue-100">
                          {BY_HREF[h].label}
                        </Link>
                      ))}
                    </div>
                    <div className="mx-1 mt-4 border-t border-line" />

                    {category.sections.map((sec) => {
                      const key = `${category.id}:${sec.title ?? ""}`;
                      const shut = !!sec.title && !!collapsed[key];
                      return (
                        <div key={key} className="pt-1">
                          {sec.title && (
                            <button
                              type="button"
                              onClick={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}
                              aria-expanded={!shut}
                              className="flex min-h-11 w-full items-center gap-2 px-1 text-left text-xs font-extrabold uppercase tracking-wider text-gray-700"
                            >
                              <ChevronDown className={`h-4 w-4 transition-transform ${shut ? "-rotate-90" : ""}`} aria-hidden />
                              {xmas && <XmasStar className="h-2.5 w-2.5 fill-[#B3202B]" />}
                              {sec.title}
                              <span className="ml-auto rounded-full bg-brand-light px-2 py-0.5 text-[0.65rem] font-bold normal-case tracking-normal text-brand-dark">{sec.hrefs.length}</span>
                            </button>
                          )}
                          {!shut && sec.hrefs.map((h) => renderRow(h, !!sec.title))}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {xmas && <p className="bg-[#FFF8EA] py-1.5 text-center text-xs font-bold tracking-wide text-[#B3202B]">Maligayang Pasko, Malineng!</p>}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
