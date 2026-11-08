"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { roleLabel } from "@/lib/activity";
import { AdminGate } from "@/components/LoginGate";
import { PageHeader } from "@/components/ui";
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

// superOnly tabs are also enforced server-side by firestore.rules.
const TABS = [
  { key: "approve", label: "I-approve", Component: AdminModeration, superOnly: false },
  { key: "verification", label: "✓ Verification", Component: AdminVerification, superOnly: false },
  { key: "ambulansya", label: "🚑 Ambulansya", Component: AdminAmbulance, superOnly: false },
  { key: "appointments", label: "Appointments", Component: AdminAppointments, superOnly: false },
  { key: "ayuda", label: "Ayuda", Component: AdminAyuda, superOnly: false },
  { key: "households", label: "Households", Component: AdminHouseholds, superOnly: false },
  { key: "registrations", label: "Registrations", Component: AdminRegistrations, superOnly: false },
  { key: "report", label: "📊 Report", Component: AdminReport, superOnly: false },
  { key: "settings", label: "Settings", Component: AdminSettings, superOnly: false },
  { key: "events", label: "Events", Component: AdminEvents, superOnly: false },
  { key: "polls", label: "Botohan", Component: AdminPolls, superOnly: false },
  { key: "purok", label: "Purok Points", Component: AdminPurok, superOnly: false },
  { key: "users", label: "👑 Users at Roles", Component: AdminUsers, superOnly: true },
  { key: "activity", label: "👑 Activity Log", Component: AdminActivity, superOnly: true },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminPage() {
  const { isSuperAdmin, profile } = useAuth();
  const tabs = useMemo(() => TABS.filter((t) => !t.superOnly || isSuperAdmin), [isSuperAdmin]);
  const [tab, setTab] = useState<TabKey>("approve");

  // Deep link: /admin/#ambulansya (used by ambulance notifications).
  useEffect(() => {
    const fromHash = () => {
      const key = window.location.hash.slice(1);
      if (tabs.some((t) => t.key === key)) setTab(key as TabKey);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs]);

  const Active = (tabs.find((t) => t.key === tab) ?? tabs[0]).Component;

  return (
    <AdminGate>
      <PageHeader title="Admin Dashboard" subtitle={profile ? `${profile.fullName} · ${roleLabel(profile.role, profile.position)}` : undefined} />
      <div className="no-scrollbar sticky top-[52px] z-30 -mx-4 mb-4 flex gap-2 overflow-x-auto bg-surface px-4 py-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              history.replaceState(null, "", `#${t.key}`);
            }}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${tab === t.key ? "bg-gold text-brand-deep" : t.superOnly ? "bg-purple-50 text-purple-700 ring-1 ring-purple-200" : "bg-white text-gray-700 shadow-card"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Active />
    </AdminGate>
  );
}
