"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { CalendarClock, HardHat } from "lucide-react";
import { db } from "@/lib/firebase";
import { INFRA_CATEGORY } from "@/lib/constants";
import { formatDate, formatPeso, timeAgo } from "@/lib/format";
import type { InfraProject } from "@/lib/types";
import { Card, EmptyState, PageHeader, SectionTitle, Spinner } from "@/components/ui";
import { BeforeAfter } from "@/components/BeforeAfter";
import { ProgressBar, ProjectStatusPill } from "@/components/ProjectBits";

function Detail() {
  const id = useSearchParams().get("id");
  const [p, setP] = useState<InfraProject | null>(null);
  const [photos, setPhotos] = useState<{ before?: string; after?: string }>({});
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    if (!id) return setState("missing");
    const unsubP = onSnapshot(doc(db, "projects", id), (snap) => {
      if (!snap.exists()) return setState("missing");
      setP({ id: snap.id, ...snap.data() } as InfraProject);
      setState("ok");
    }, () => setState("missing"));
    const unsubPhotos = onSnapshot(doc(db, "projectPhotos", id), (snap) => setPhotos((snap.data() as { before?: string; after?: string }) ?? {}), () => undefined);
    return () => {
      unsubP();
      unsubPhotos();
    };
  }, [id]);

  if (state === "loading") return <Spinner />;
  if (state === "missing" || !p) return <EmptyState icon={<HardHat />} title="Hindi mahanap ang proyekto" />;

  const before = photos.before || p.beforeThumb;
  const after = photos.after || p.afterThumb;
  const isInfra = p.category === INFRA_CATEGORY;
  const rows: [string, string][] = [
    ["Uri", p.category],
    ["Lokasyon", p.location || "Barangay Malineng"],
    ["Budget", p.budget > 0 ? formatPeso(p.budget) : "—"],
    ["Pondo mula sa", p.fundSource || "—"],
    ["Nagpatupad", p.implementer || "—"],
    ["Sinimulan", p.startDate ? formatDate(p.startDate) : "—"],
    ["Target na matapos", p.targetDate ? formatDate(p.targetDate) : "—"],
    ...(p.completedDate ? ([["Natapos", formatDate(p.completedDate)]] as [string, string][]) : []),
  ];

  return (
    <div>
      <PageHeader title={p.name} subtitle={`Huling update ${timeAgo(p.updatedAt)}`} />

      {/* Photos: drag slider when both exist; otherwise whichever is available */}
      {before && after ? (
        <>
          <BeforeAfter before={before} after={after} alt={p.name} />
          <p className="mt-1 text-center text-xs text-gray-500">⇆ Hilahin pakaliwa o pakanan para ikumpara</p>
        </>
      ) : before || after ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={(before || after)!} alt={p.name} className="aspect-[4/3] w-full rounded-2xl object-cover" />
          {isInfra && <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white">{before ? "BEFORE" : "AFTER"}</span>}
        </div>
      ) : null}

      <Card className="mt-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <ProjectStatusPill status={p.status} />
          <span className="text-lg font-extrabold text-brand">{p.progress}%</span>
        </div>
        <ProgressBar value={p.progress} />
        {p.description && <p className="whitespace-pre-line text-sm text-gray-700">{p.description}</p>}
        <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-gray-500">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {p.updates?.length > 0 && (
        <>
          <SectionTitle>Mga Update</SectionTitle>
          <ol className="relative space-y-3 border-l-2 border-brand-light pl-4">
            {[...p.updates].sort((a, b) => b.date.localeCompare(a.date)).map((u, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[1.42rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand" aria-hidden />
                <p className="flex items-center gap-1 text-xs font-semibold text-gray-500"><CalendarClock className="h-3 w-3" /> {formatDate(u.date)}</p>
                <p className="text-sm">{u.note}</p>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

export default function ProjectItemPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Detail />
    </Suspense>
  );
}
