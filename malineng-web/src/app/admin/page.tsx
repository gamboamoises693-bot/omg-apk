"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  Ambulance,
  ArrowLeft,
  BadgeCheck,
  BellOff,
  BellRing,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Crown,
  FileBarChart,
  HandCoins,
  HardHat,
  ScrollText,
  Settings as SettingsIcon,
  Trophy,
  Users,
  Vote,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAdminPending } from "@/context/AdminPendingContext";
import { ALERTS_EVENT, getAlertsEnabled } from "@/lib/alerts";
import { roleLabel } from "@/lib/activity";
import { AdminGate } from "@/components/LoginGate";
import { Avatar } from "@/components/Avatar";
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
import { AdminHouseholds } from "@/components/admin/AdminHouseholds";
import { AdminReport } from "@/components/admin/AdminReport";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminActivity } from "@/components/admin/AdminActivity";
import { AdminProjects } from "@/components/admin/AdminProjects";

interface Section {
  key: string;
  label: string;
  icon: LucideIcon;
  Component: ComponentType;
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
      { key: "approve", label: "I-approve", icon: ClipboardCheck, Component: AdminModeration },
      { key: "verification", label: "Verification", icon: BadgeCheck, Component: AdminVerification },
      { key: "ambulansya", label: "Ambulansya", icon: Ambulance, Component: AdminAmbulance },
      { key: "appointments", label: "Appointments", icon: CalendarCheck, Component: AdminAppointments },
    ],
  },
  {
    title: "Mga residente",
    sections: [
      { key: "ayuda", label: "Ayuda", icon: HandCoins, Component: AdminAyuda },
      { key: "households", label: "Households", icon: Users, Component: AdminHouseholds },
      { key: "registrations", label: "Registrations", icon: ClipboardList, Component: AdminRegistrations },
    ],
  },
  {
    title: "Website at komunidad",
    sections: [
      { key: "proyekto", label: "Proyekto", icon: HardHat, Component: AdminProjects },
      { key: "events", label: "Events", icon: CalendarDays, Component: AdminEvents },
      { key: "polls", label: "Botohan", icon: Vote, Component: AdminPolls },
      { key: "purok", label: "Purok Points", icon: Trophy, Component: AdminPurok },
      { key: "report", label: "Report", icon: FileBarChart, Component: AdminReport },
      { key: "settings", label: "Settings", icon: SettingsIcon, Component: AdminSettings },
    ],
  },
  {
    title: "Super Admin lang",
    superOnly: true,
    sections: [
      { key: "users", label: "Users at Roles", icon: Crown, Component: AdminUsers },
      { key: "activity", label: "Activity Log", icon: ScrollText, Component: AdminActivity },
    ],
  },
];

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[0.7rem] font-black text-white">{n > 99 ? "99+" : n}</span>;
}

export default function AdminPage() {
  const { isSuperAdmin, profile } = useAuth();
  const { byTab, total } = useAdminPending();
  const groups = useMemo(() => GROUPS.filter((g) => !g.superOnly || isSuperAdmin), [isSuperAdmin]);
  const sections = useMemo(() => groups.flatMap((g) => g.sections), [groups]);
  const [current, setCurrent] = useState("approve");
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
          <p className="flex items-center gap-1.5 text-base font-bold">
            <ActiveIcon className="h-4 w-4 text-brand" aria-hidden /> {active.label}
            <Badge n={byTab[active.key]} />
          </p>
        </div>
      </div>

      {active.key === "approve" && (
        <div className="mb-4">
          <AlertsSettingsCard />
        </div>
      )}
      <Active />

      {/* Side drawer */}
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button className="absolute inset-0 h-full w-full cursor-default bg-black/40" onClick={() => setOpen(false)} aria-label="Isara ang menu" tabIndex={-1} />
          <nav className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-white shadow-2xl motion-safe:animate-drawer-in">
            <div className="flex items-center gap-3 bg-gradient-to-br from-brand to-brand-deep px-4 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
              <Avatar name={profile?.fullName ?? "Admin"} photo={profile?.photoURL} size="h-11 w-11" textClass="text-base" ring="ring-2 ring-white/40" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{profile?.fullName}</p>
                <p className="truncate text-xs text-white/85">
                  {isSuperAdmin ? "👑 " : ""}{profile ? roleLabel(profile.role, profile.position) : ""}{total ? ` · ${total} naghihintay` : ""}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full p-1.5 active:bg-white/15" aria-label="Isara">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-3">
              {groups.map((g) => (
                <div key={g.title}>
                  <p className={`px-2 pb-1 pt-3 text-[0.68rem] font-bold uppercase tracking-wider ${g.superOnly ? "text-purple-600" : "text-gray-500"}`}>{g.title}</p>
                  {g.sections.map((s) => {
                    const Icon = s.icon;
                    const on = s.key === active.key;
                    return (
                      <button
                        key={s.key}
                        onClick={() => choose(s.key)}
                        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left ${on ? "bg-gold-light" : "active:bg-gray-50"}`}
                        aria-current={on ? "page" : undefined}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${g.superOnly ? "bg-purple-50 text-purple-600" : "bg-brand-light text-brand"}`}>
                          <Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden />
                        </span>
                        <span className={`min-w-0 flex-1 truncate text-sm ${on ? "font-bold" : "font-medium"} ${g.superOnly ? "text-purple-700" : "text-gray-800"}`}>{s.label}</span>
                        <Badge n={byTab[s.key]} />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm">
              <Link href="/" className="flex items-center gap-1 font-semibold text-brand">
                <ArrowLeft className="h-4 w-4" /> Bumalik sa website
              </Link>
              <button onClick={() => choose("approve")} className={`flex items-center gap-1 text-xs font-semibold ${alertsOn ? "text-brand" : "text-gray-500"}`}>
                {alertsOn ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />} Alerts: {alertsOn ? "ON" : "OFF"}
              </button>
            </div>
          </nav>
        </div>
      )}
    </AdminGate>
  );
}
