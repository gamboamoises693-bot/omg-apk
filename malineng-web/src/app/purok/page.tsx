"use client";

import { useMemo } from "react";
import { collection } from "firebase/firestore";
import { Trophy, Medal } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { usePuroks } from "@/lib/useSettings";
import type { PurokPoints } from "@/lib/types";
import { Card, PageHeader, Spinner } from "@/components/ui";

const purokCollection = collection(db, "purokPoints");
const MEDAL_COLORS = ["text-yellow-500", "text-gray-400", "text-amber-700"];

export default function PurokPage() {
  const { data, loading } = useCollection<PurokPoints>(purokCollection);
  const puroks = usePuroks();

  // Always show every purok from Settings, even those without points yet.
  const ranking = useMemo(() => {
    return puroks.map((purok) => {
      const found = data.find((d) => d.purok === purok);
      return { purok, points: found?.points ?? 0, cleanupCount: found?.cleanupCount ?? 0 };
    }).sort((a, b) => b.points - a.points);
  }, [data, puroks]);

  const max = Math.max(1, ...ranking.map((r) => r.points));

  return (
    <div>
      <PageHeader title="Purok Points" subtitle="Paligsahan ng kalinisan at bayanihan" />
      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          {ranking.map((r, i) => (
            <Card key={r.purok} className={i === 0 && r.points > 0 ? "ring-2 ring-gold" : ""}>
              <div className="flex items-center gap-3">
                <span className="w-8 text-center text-2xl font-black text-gray-400">{i + 1}</span>
                {i < 3 && r.points > 0 ? <Medal className={`h-8 w-8 ${MEDAL_COLORS[i]}`} /> : <Trophy className="h-8 w-8 text-gray-200" />}
                <div className="flex-1">
                  <div className="flex justify-between">
                    <p className="text-lg font-bold">{r.purok}</p>
                    <p className="text-lg font-black text-brand">{r.points} pts</p>
                  </div>
                  <div className="mt-1 h-3 overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand to-gold" style={{ width: `${(r.points / max) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{r.cleanupCount} clean-up drive</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
