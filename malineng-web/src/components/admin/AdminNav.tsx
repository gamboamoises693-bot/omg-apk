"use client";

import { useRouter } from "next/navigation";
import { BellOff, BellRing, Home, LogOut, Settings as SettingsIcon, type LucideIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { roleLabel } from "@/lib/activity";
import { XmasStar } from "@/components/Xmas";
import { GlassSidebar, type SideAction, type SideGroup } from "@/components/GlassSidebar";
import { useLatestNotice } from "@/lib/useLatestNotice";

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

/** Admin menu: the curved glass sidebar (groups open like an accordion, Settings and Logout at the bottom). */
export function AdminNav({ open, onClose, categories, current, onChoose, alertsOn, onAlerts, xmas }: Props) {
  const { user, profile, logout } = useAuth();
  const router = useRouter();
  const notice = useLatestNotice();

  const groups: SideGroup[] = categories.map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    items: c.items.map((i) => ({ key: i.key, label: i.label, href: i.href, badge: i.badge })),
  }));
  const hasSettings = categories.some((c) => c.items.some((i) => i.key === "settings"));
  const actions: SideAction[] = [
    ...(hasSettings ? [{ key: "settings", label: "Settings", icon: SettingsIcon, onClick: () => onChoose("settings") }] : []),
    { key: "alerts", label: "Alerts", icon: alertsOn ? BellRing : BellOff, note: alertsOn ? "ON" : "OFF", onClick: onAlerts },
    { key: "website", label: "Website", icon: Home, href: "/" },
    {
      key: "logout",
      label: "Mag-logout",
      icon: LogOut,
      onClick: async () => {
        onClose();
        await logout();
        router.replace("/login");
      },
    },
  ];

  return (
    <GlassSidebar
      open={open}
      onClose={onClose}
      ariaLabel="Admin menu"
      user={user && profile ? { name: profile.fullName, role: roleLabel(profile.role, profile.position), photo: profile.photoURL, href: "/account", online: true } : null}
      groups={groups}
      current={current}
      onSelect={(i) => onChoose(i.key)}
      notice={notice}
      actions={actions}
      footer={
        xmas ? (
          <p className="flex items-center justify-center gap-1 text-center text-xs font-bold tracking-wide text-[#f6d587]">
            <XmasStar className="h-2.5 w-2.5 fill-[#f6d587]" /> Maligayang Pasko, Malineng!
          </p>
        ) : null
      }
    />
  );
}
