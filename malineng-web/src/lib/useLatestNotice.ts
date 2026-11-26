"use client";

import { useMemo } from "react";
import { useSettings } from "@/lib/useSettings";
import { isAnnouncementActive } from "@/lib/types";
import { todayISO } from "@/lib/format";
import type { SideNotice } from "@/components/GlassSidebar";

/** The newest announcement that is still active, shaped for the sidebar's notice card. */
export function useLatestNotice(): SideNotice | null {
  const { settings } = useSettings();
  return useMemo(() => {
    const today = todayISO();
    const list = settings.announcements.filter((a) => isAnnouncementActive(a, today)).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const a = list[0];
    if (!a) return null;
    const d = a.date ? new Date(`${a.date}T00:00:00`) : null;
    const when = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("fil-PH", { month: "short", day: "numeric" }).toUpperCase() : "";
    return { kicker: `ANUNSYO${when ? ` · ${when}` : ""}`, title: a.title, text: a.body, href: "/" };
  }, [settings.announcements]);
}
