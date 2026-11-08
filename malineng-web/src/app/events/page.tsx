"use client";

import { useMemo } from "react";
import { collection } from "firebase/firestore";
import { CalendarDays, MapPin } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { formatDate, todayISO } from "@/lib/format";
import type { BarangayEvent } from "@/lib/types";
import { Card, EmptyState, LinkButton, PageHeader, SectionTitle, Spinner } from "@/components/ui";

const eventsCollection = collection(db, "events");

function EventCard({ e, past = false }: { e: BarangayEvent; past?: boolean }) {
  const d = new Date(`${e.date}T00:00:00`);
  return (
    <Card className={`flex gap-4 ${past ? "opacity-60" : ""}`}>
      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-brand py-2 text-white">
        <span className="text-xs font-semibold uppercase">{d.toLocaleDateString("fil-PH", { month: "short" })}</span>
        <span className="text-xl font-black">{d.getDate() || "?"}</span>
      </div>
      <div className="min-w-0">
        <p className="text-base font-bold leading-tight">{e.title}</p>
        <p className="text-sm text-gray-500">{formatDate(e.date)}</p>
        {e.location && <p className="flex items-center gap-1 text-gray-600"><MapPin className="h-4 w-4" /> {e.location}</p>}
        {e.description && <p className="mt-1 whitespace-pre-line text-gray-700">{e.description}</p>}
      </div>
    </Card>
  );
}

export default function EventsPage() {
  const { data, loading } = useCollection<BarangayEvent>(eventsCollection);
  const { upcoming, past } = useMemo(() => {
    const today = todayISO();
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    return {
      upcoming: sorted.filter((e) => e.date >= today),
      past: sorted.filter((e) => e.date < today).reverse().slice(0, 10),
    };
  }, [data]);

  return (
    <div>
      <PageHeader title="Mga Event" subtitle="Kalendaryo ng Barangay Malineng" />
      <LinkButton href="/register-event" variant="gold" full className="mb-4">Magparehistro sa Event</LinkButton>
      {loading ? (
        <Spinner />
      ) : (
        <>
          {upcoming.length === 0 ? (
            <EmptyState icon={<CalendarDays className="h-12 w-12" />} title="Wala pang paparating na event" />
          ) : (
            <div className="space-y-3">{upcoming.map((e) => <EventCard key={e.id} e={e} />)}</div>
          )}
          {past.length > 0 && (
            <>
              <SectionTitle>Mga Natapos na</SectionTitle>
              <div className="space-y-3">{past.map((e) => <EventCard key={e.id} e={e} past />)}</div>
            </>
          )}
        </>
      )}
    </div>
  );
}
