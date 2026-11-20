"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BellOff, BellRing, Home, Search, UserCircle, X, type LucideIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { roleLabel } from "@/lib/activity";
import { Avatar } from "@/components/Avatar";
import { XmasStar } from "@/components/Xmas";

/** One row in the panel: an admin section (`key`) or a link to another page (`href`). */
export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  /** Number of things waiting (red badge). */
  badge?: number;
}

/** One button in the rail with the rows it opens. */
export interface NavCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  categories: NavCategory[];
  /** Key of the admin section shown now. */
  current: string;
  onChoose: (key: string) => void;
  alertsOn: boolean;
  /** Opens the alerts settings. */
  onAlerts: () => void;
  xmas: boolean;
}

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[0.7rem] font-black text-white">{n > 99 ? "99+" : n}</span>;
}

/** Admin menu: category rail on the left, search and sections on the right (same look as the residents' menu). */
export function AdminNav({ open, onClose, categories, current, onChoose, alertsOn, onAlerts, xmas }: Props) {
  const { user, profile, isSuperAdmin } = useAuth();
  const [catId, setCatId] = useState(categories[0]?.id ?? "");
  const [query, setQuery] = useState("");

  // Every time the menu opens: start on the category of the current section, with a clean search.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCatId(categories.find((c) => c.items.some((i) => i.key === current))?.id ?? categories[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const category = categories.find((c) => c.id === catId) ?? categories[0];
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const results = useMemo(() => (searching ? categories.flatMap((c) => c.items).filter((i) => i.label.toLowerCase().includes(q)) : []), [categories, q, searching]);
  if (!open || !category) return null;

  const row = (item: NavItem) => {
    const on = !item.href && item.key === current;
    const Icon = item.icon;
    const inner = (
      <>
        {on && <span className="absolute inset-y-2.5 left-0 w-1 rounded-r bg-gold" aria-hidden />}
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand"><Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden /></span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <Badge n={item.badge} />
      </>
    );
    const cls = `relative flex min-h-[2.9rem] w-full items-center gap-3 rounded-xl px-2.5 text-left text-[0.95rem] ${on ? "bg-gold-light font-bold" : "font-medium active:bg-brand-light"} text-gray-800`;
    return item.href ? (
      <Link key={item.key} href={item.href} onClick={onClose} className={cls}>{inner}</Link>
    ) : (
      <button key={item.key} type="button" onClick={() => onChoose(item.key)} aria-current={on ? "page" : undefined} className={cls}>{inner}</button>
    );
  };

  const railBtn = "flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-1 text-[0.65rem] font-semibold text-blue-100";

  return (
    <div className="fixed inset-0 z-50 text-gray-900" role="dialog" aria-modal="true" aria-label="Admin menu">
      <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-black/45" onClick={onClose} aria-label="Isara ang menu" tabIndex={-1} />
      <nav className="absolute inset-y-0 left-0 flex w-[92%] max-w-sm bg-surface shadow-2xl motion-safe:animate-drawer-in">
        {/* Rail */}
        <div className="flex w-[4.75rem] shrink-0 flex-col items-center bg-brand-deep pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="h-1 w-full bg-gradient-to-r from-[#0038A8] from-50% to-[#CE1126] to-50%" aria-hidden />
          <Link href="/account" onClick={onClose} aria-label={profile ? `${profile.fullName} (${roleLabel(profile.role, profile.position)})` : "Account ko"} className="mb-3 mt-[max(0.75rem,env(safe-area-inset-top))]">
            {user && profile ? (
              <Avatar name={profile.fullName} photo={profile.photoURL} size="h-12 w-12" textClass="text-base" ring="ring-2 ring-white/30" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white"><UserCircle className="h-6 w-6" aria-hidden /></span>
            )}
          </Link>
          <div className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-1">
            {categories.map((c) => {
              const on = c.id === category.id && !searching;
              const Icon = c.icon;
              const waiting = c.items.reduce((n, i) => n + (i.badge ?? 0), 0);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setCatId(c.id); setQuery(""); }}
                  aria-pressed={on}
                  className={`relative flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 rounded-2xl text-[0.65rem] ${on ? "bg-gold font-extrabold text-brand-deep" : "font-semibold text-blue-100 active:bg-white/10"}`}
                >
                  <Icon className="h-6 w-6" aria-hidden />
                  {c.label}
                  {waiting > 0 && (
                    <span className="absolute right-1 top-0.5 flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[0.6rem] font-black text-white ring-2 ring-brand-deep" aria-label={`${waiting} naghihintay`}>
                      {waiting > 99 ? "99+" : waiting}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={onAlerts} className={railBtn}>
            {alertsOn ? <BellRing className="h-6 w-6" aria-hidden /> : <BellOff className="h-6 w-6" aria-hidden />}
            Alerts {alertsOn ? "ON" : "OFF"}
          </button>
          <Link href="/" onClick={onClose} className={railBtn}>
            <Home className="h-6 w-6" aria-hidden />
            Website
          </Link>
        </div>

        {/* Panel */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-widest text-gray-600">{searching ? "Resulta" : category.label}</p>
              <p className="truncate text-sm text-gray-600">
                {searching ? `${results.length} nakita` : `${category.items.length} seksyon`}
                {profile ? ` · ${isSuperAdmin ? "👑 " : ""}${roleLabel(profile.role, profile.position)}` : ""}
              </p>
            </div>
            <button type="button" onClick={onClose} className="-mr-2 -mt-1 flex h-11 w-11 items-center justify-center rounded-full active:bg-brand-light" aria-label="Isara">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 pt-3">
            <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-gray-300 bg-white px-3 focus-within:border-brand">
              <Search className="h-5 w-5 shrink-0 text-gray-600" aria-hidden />
              <span className="sr-only">Maghanap ng seksyon</span>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Maghanap sa lahat…" className="min-w-0 flex-1 bg-transparent text-[0.95rem] outline-none" />
            </label>
          </div>

          <div className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3 pt-3">
            {searching ? (
              results.length === 0 ? <p className="px-3 py-6 text-center text-sm text-gray-600">Walang nakita. Subukan ang ibang salita.</p> : results.map(row)
            ) : (
              category.items.map(row)
            )}
          </div>

          {xmas && (
            <p className="flex items-center justify-center gap-1 bg-[#FFF8EA] py-1.5 text-center text-xs font-bold tracking-wide text-[#B3202B]">
              <XmasStar className="h-2.5 w-2.5 fill-[#B3202B]" /> Maligayang Pasko, Malineng!
            </p>
          )}
        </div>
      </nav>
    </div>
  );
}
