"use client";

import { useState } from "react";
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

const TABS = [
  { key: "approve", label: "I-approve", Component: AdminModeration },
  { key: "appointments", label: "Appointments", Component: AdminAppointments },
  { key: "ayuda", label: "Ayuda", Component: AdminAyuda },
  { key: "registrations", label: "Registrations", Component: AdminRegistrations },
  { key: "settings", label: "Settings", Component: AdminSettings },
  { key: "events", label: "Events", Component: AdminEvents },
  { key: "polls", label: "Botohan", Component: AdminPolls },
  { key: "purok", label: "Purok Points", Component: AdminPurok },
] as const;

export default function AdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("approve");
  const Active = TABS.find((t) => t.key === tab)!.Component;

  return (
    <AdminGate>
      <PageHeader title="Admin Dashboard" subtitle="Pamahalaan ang website ng Barangay" />
      <div className="sticky top-[64px] z-30 -mx-4 mb-4 flex gap-2 overflow-x-auto bg-surface px-4 py-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-full px-4 py-2 font-semibold ${tab === t.key ? "bg-gold text-brand-dark" : "bg-white text-gray-700 ring-1 ring-gray-200"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Active />
    </AdminGate>
  );
}
