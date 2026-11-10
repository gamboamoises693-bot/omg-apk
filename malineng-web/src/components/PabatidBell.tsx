"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Megaphone, X } from "lucide-react";
import { notificationPermission, showSystemNotification } from "@/lib/alerts";
import { categoryBadge, isUrgent, markAllSeen, useMyAnnouncements, type Announcement } from "@/lib/pabatid";

/** Bell with an unread badge; links to /pabatid. */
export function PabatidBell() {
  const { unread } = useMyAnnouncements();
  const n = unread.length;
  return (
    <Link
      href="/pabatid"
      className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15 active:bg-white/25"
      aria-label={n ? `Pabatid, ${n} bago` : "Pabatid"}
    >
      <Bell className="h-5 w-5" />
      {n > 0 && (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black ring-2 ring-brand">
          {n > 99 ? "99+" : n}
        </span>
      )}
    </Link>
  );
}

/**
 * Mounted once in the app shell:
 * - pops up the newest unread URGENT/Kalamidad notice when the site opens;
 * - while the site is open, shows a phone notification for each NEW notice
 *   (only if the resident turned notifications on in /pabatid).
 * Free-plan limit: nothing rings while the website is closed.
 */
export function PabatidWatcher() {
  const { unread, loading } = useMyAnnouncements();
  const [popup, setPopup] = useState<Announcement | null>(null);
  const known = useRef<Set<string> | null>(null);
  const dismissed = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (loading) return;
    const urgent = unread.find((a) => isUrgent(a) && !dismissed.current.has(a.id));
    if (urgent && window.location.pathname.replace(/\/$/, "") !== "/pabatid") setPopup(urgent);

    // Phone notification for notices that arrive while the site is open.
    if (known.current === null) {
      known.current = new Set(unread.map((a) => a.id));
      return;
    }
    const fresh = unread.filter((a) => !known.current!.has(a.id));
    fresh.forEach((a) => known.current!.add(a.id));
    if (fresh.length && notificationPermission() === "granted") {
      const top = fresh[0];
      void showSystemNotification(`📢 ${top.title}`, top.body.slice(0, 140), isUrgent(top) ? "emergency" : "schedule", `pabatid:${top.id}`, "/pabatid");
    }
  }, [unread, loading]);

  if (!popup) return null;

  const close = () => {
    dismissed.current.add(popup.id);
    setPopup(null);
  };

  return (
    <div className="fixed inset-x-3 top-3 z-[60] mx-auto max-w-lg rounded-2xl bg-white p-4 shadow-2xl ring-2 ring-red-300" role="alertdialog" aria-labelledby="pabatid-popup-title">
      <div className="flex items-start gap-3">
        <span className="rounded-full bg-red-50 p-2 text-red-600">
          <Megaphone className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[0.65rem] font-black uppercase ${categoryBadge(popup.category)}`}>{popup.category}</span>
          <p id="pabatid-popup-title" className="mt-1 font-extrabold">{popup.title}</p>
          <p className="line-clamp-3 text-sm text-gray-700">{popup.body}</p>
          <Link
            href="/pabatid"
            onClick={() => {
              close();
              markAllSeen();
            }}
            className="mt-2 inline-block text-sm font-bold text-brand"
          >
            Basahin lahat →
          </Link>
        </div>
        <button onClick={close} className="rounded-full p-1 text-gray-500 active:bg-gray-100" aria-label="Isara">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
