"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { collection } from "firebase/firestore";
import { HardHat, ImageOff, MapPin, Wallet } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { PROJECT_STATUS_LABEL } from "@/lib/constants";
import { formatDate, formatPeso } from "@/lib/format";
import type { InfraProject, InfraProjectStatus } from "@/lib/types";
import { EmptyState, PageHeader, Spinner } from "@/components/ui";
import { ProgressBar, ProjectStatusPill, compareProjects } from "@/components/ProjectBits";

const projectsCollection = collection(db, "projects");
type Filter = "lahat" | InfraProjectStatus;

export default function ProyektoPage() {
  const { data, loading } = useCollection<InfraProject>(projectsCollection);
  const [filter, setFilter] = useState<Filter>("lahat");

  const list = useMemo(
    () =>
      data
        .filter((p) => filter === "lahat" || p.status === filter)
        .sort(compareProjects),
    [data, filter],
  );
  const total = data.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);

  return (
    <div>
      <PageHeader title="Mga Proyekto" subtitle="Transparency · saan napupunta ang pondo ng Barangay" />

      <div className="mb-3 grid grid-cols-3 gap-2">
        {[
          { label: "Proyekto", value: String(data.length) },
          { label: "Tapos na", value: String(data.filter((p) => p.status === "completed").length) },
          { label: "Kabuuang budget", value: formatPeso(total).replace(".00", "") },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-2.5 text-center shadow-card">
            <p className="truncate text-base font-extrabold tabular-nums">{s.value}</p>
            <p className="text-[0.7rem] font-semibold text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
        {(["lahat", "ongoing", "planned", "completed", "delayed"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${filter === f ? "bg-brand text-white" : "bg-white text-gray-600 shadow-card"}`}>
            {f === "lahat" ? "Lahat" : PROJECT_STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState icon={<HardHat />} title="Wala pang proyektong naka-post" />
      ) : (
        <div className="space-y-3">
          {list.map((p) => {
            const thumb = p.afterThumb || p.beforeThumb;
            return (
              <Link key={p.id} href={`/proyekto/item?id=${p.id}`} className="flex gap-3 rounded-2xl bg-white p-3 shadow-card active:bg-gray-50">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-300"><ImageOff className="h-7 w-7" /></span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 font-bold leading-tight">{p.name}</p>
                    <ProjectStatusPill status={p.status} />
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-500"><MapPin className="h-3 w-3" /> {p.location || "Barangay Malineng"} · {p.category}</p>
                  {p.budget > 0 && <p className="flex items-center gap-1 text-xs font-semibold text-gray-700"><Wallet className="h-3 w-3" /> {formatPeso(p.budget)}</p>}
                  {p.status === "completed" && p.completedDate && <p className="text-xs font-semibold text-brand-dark">Natapos {formatDate(p.completedDate)}</p>}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1"><ProgressBar value={p.progress} /></div>
                    <span className="text-xs font-bold text-brand">{p.progress}%</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
