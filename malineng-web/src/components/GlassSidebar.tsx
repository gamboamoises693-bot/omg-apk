"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, LogIn, Lock, Search, X, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { LogoMark } from "@/components/BarangayLogo";

/** One link or action inside a group. Give it `href` for a page, or handle it in `onSelect`. */
export interface SideItem {
  key: string;
  label: string;
  href?: string;
  /** Red number (things waiting). */
  badge?: number;
  /** Red text (emergency services). */
  emergency?: boolean;
  /** Shown dimmed with a lock (a service the Developer has not opened yet). */
  locked?: boolean;
  /** Small gray note at the end ("Off sa residente"). */
  note?: string;
  /** Small heading shown above this item inside the group (e.g. "Usapan"). */
  heading?: string;
}

/** A collapsible group (accordion) of items. */
export interface SideGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  emergency?: boolean;
  items: SideItem[];
}

/** A button at the bottom (Settings, Logout, Website...). */
export interface SideAction {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  /** Small text on the right ("ON", "OFF"). */
  note?: string;
}

export interface SideUser {
  name: string;
  role: string;
  photo?: string;
  href: string;
  /** Green dot. */
  online?: boolean;
}

export interface SideNotice {
  /** Small line above the title, e.g. "ANUNSYO · NOB 28". */
  kicker: string;
  title: string;
  text?: string;
  href?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  /** null = a visitor (shows a login button). */
  user: SideUser | null;
  groups: SideGroup[];
  /** Key of the current item (highlighted; its group opens first). */
  current?: string;
  /** Called for an item without `href`. */
  onSelect?: (item: SideItem) => void;
  /** Shortcut chips under the search box. */
  quick?: SideItem[];
  notice?: SideNotice | null;
  actions?: SideAction[];
  /** Extra line at the very bottom (Christmas greeting). */
  footer?: ReactNode;
  /** Group to open first when nothing is current. */
  defaultGroupId?: string;
}

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[0.68rem] font-black text-white">{n > 99 ? "99+" : n}</span>;
}

/**
 * Curved glass sidebar (admin menu and residents' menu). It is dark glass in every look, so it reads the same
 * on any page; its accent follows the glass theme colors when they exist (see .gside in globals.css).
 */
export function GlassSidebar({ open, onClose, ariaLabel, user, groups, current, onSelect, quick, notice, actions, footer, defaultGroupId }: Props) {
  const [openId, setOpenId] = useState<string>("");
  const [query, setQuery] = useState("");

  // Every time it opens: the group of the current item (or the default) is open, with a clean search.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setOpenId(groups.find((g) => g.items.some((i) => i.key === current))?.id ?? defaultGroupId ?? groups[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape closes it and the page behind stops scrolling.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const results = useMemo(() => (searching ? groups.flatMap((g) => g.items).filter((i) => i.label.toLowerCase().includes(q)) : []), [groups, q, searching]);
  if (!open) return null;

  const row = (item: SideItem, nested: boolean) => {
    const on = item.key === current;
    const cls = `gside-sub ${nested ? "" : "gside-sub-flat"} ${on ? "gside-on" : ""} ${item.emergency ? "gside-emergency" : ""} ${item.locked ? "gside-locked" : ""}`;
    const inner = (
      <>
        <span className="gside-dot" aria-hidden />
        {item.locked && <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.note && <span className="gside-note">{item.note}</span>}
        <Badge n={item.badge} />
      </>
    );
    return item.href ? (
      <Link key={item.key} href={item.href} onClick={onClose} aria-current={on ? "page" : undefined} className={cls}>{inner}</Link>
    ) : (
      <button key={item.key} type="button" onClick={() => onSelect?.(item)} aria-current={on ? "page" : undefined} className={cls}>{inner}</button>
    );
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <button type="button" className="gside-backdrop absolute inset-0 h-full w-full cursor-default" onClick={onClose} aria-label="Isara ang menu" tabIndex={-1} />
      <div className="gside-wrap absolute bottom-3 left-3 top-3 w-[88%] max-w-[22rem] motion-safe:animate-drawer-in">
        <nav className="gside">
          {/* Top: logo and close */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <LogoMark size="h-9 w-9" textClass="text-xs" />
              <b className="text-[0.78rem] tracking-[0.22em]">MALINENG</b>
            </div>
            <button type="button" onClick={onClose} className="gside-iconbtn" aria-label="Isara">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Profile */}
          {user ? (
            <Link href={user.href} onClick={onClose} className="gside-profile">
              <span className="relative shrink-0">
                <Avatar name={user.name} photo={user.photo} size="h-12 w-12" textClass="text-base" ring="ring-2 ring-[#e8c766]/80" />
                {user.online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0f2350] bg-emerald-400" aria-label="Online" />}
              </span>
              <span className="min-w-0 leading-tight">
                <b className="block truncate text-[1.05rem]">{user.name}</b>
                <span className="block truncate text-[0.74rem] opacity-70">{user.role}</span>
              </span>
            </Link>
          ) : (
            <Link href="/login" onClick={onClose} className="gside-profile">
              <span className="gside-ico"><LogIn className="h-5 w-5" aria-hidden /></span>
              <span className="min-w-0 leading-tight">
                <b className="block text-[1.05rem]">Mag-login</b>
                <span className="block text-[0.74rem] opacity-70">Bisita ka ngayon</span>
              </span>
            </Link>
          )}

          {/* Search */}
          <label className="gside-search">
            <Search className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            <span className="sr-only">Maghanap sa menu</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Maghanap sa lahat…" />
          </label>

          <div className="gside-scroll">
            {searching ? (
              <div className="space-y-0.5 pt-2">
                <p className="gside-label">{results.length} nakita</p>
                {results.length === 0 ? <p className="px-2 py-4 text-center text-sm opacity-70">Walang nakita. Subukan ang ibang salita.</p> : results.map((i) => row(i, false))}
              </div>
            ) : (
              <>
                {quick && quick.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-1 pt-2">
                    {quick.map((i) => (
                      <Link key={i.key} href={i.href ?? "#"} onClick={onClose} className="gside-chip">{i.label}</Link>
                    ))}
                  </div>
                )}
                <p className="gside-label">Menu</p>
                <div className="space-y-1">
                  {groups.map((g) => {
                    const isOpen = openId === g.id;
                    const Icon = g.icon;
                    const waiting = g.items.reduce((n, i) => n + (i.badge ?? 0), 0);
                    return (
                      <div key={g.id}>
                        <button
                          type="button"
                          onClick={() => setOpenId(isOpen ? "" : g.id)}
                          aria-expanded={isOpen}
                          className={`gside-group ${isOpen ? "gside-group-open" : ""} ${g.emergency ? "gside-emergency" : ""}`}
                        >
                          <span className="gside-ico"><Icon className="h-4 w-4" aria-hidden /></span>
                          <span className="min-w-0 flex-1 truncate text-left">{g.label}</span>
                          {!isOpen && <Badge n={waiting} />}
                          <ChevronDown className={`h-4 w-4 shrink-0 opacity-60 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                        </button>
                        {isOpen && (
                          <div className="gside-tree">
                            {g.items.map((i) => (
                              <div key={i.key}>
                                {i.heading && <p className="gside-label !mt-2 !pl-1">{i.heading}</p>}
                                {row(i, true)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {notice && (
                  <Link href={notice.href ?? "/"} onClick={onClose} className="gside-notice">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.55rem] font-extrabold tracking-[0.14em] opacity-55">{notice.kicker}</span>
                      <span className="block font-serif text-[1.15rem] font-extrabold leading-tight">{notice.title}</span>
                      {notice.text && <span className="mt-0.5 block text-[0.72rem] opacity-70 line-clamp-2">{notice.text}</span>}
                    </span>
                    <span className="gside-gem" aria-hidden />
                  </Link>
                )}
              </>
            )}
          </div>

          {/* Bottom: Settings, Logout... */}
          {actions && actions.length > 0 && (
            <div className="gside-actions">
              {actions.map((a) => {
                const Icon = a.icon;
                const inner = (
                  <>
                    <span className="gside-ico"><Icon className="h-4 w-4" aria-hidden /></span>
                    <span className="min-w-0 flex-1 truncate text-left">{a.label}</span>
                    {a.note && <span className="gside-note">{a.note}</span>}
                  </>
                );
                return a.href ? (
                  <Link key={a.key} href={a.href} onClick={onClose} className="gside-group">{inner}</Link>
                ) : (
                  <button key={a.key} type="button" onClick={a.onClick} className="gside-group">{inner}</button>
                );
              })}
            </div>
          )}
          {footer}
        </nav>
      </div>
    </div>
  );
}
