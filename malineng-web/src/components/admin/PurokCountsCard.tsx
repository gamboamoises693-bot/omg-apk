"use client";

import { Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePurokCounts } from "@/lib/purokStats";
import { Card, Spinner } from "@/components/ui";

/** How many members (and verified members) each purok has. For admins. */
export function PurokCountsCard() {
  const { isAdmin } = useAuth();
  const c = usePurokCounts(isAdmin);
  if (!isAdmin) return null;
  const max = Math.max(1, ...c.rows.map((r) => r.members));
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-extrabold"><Users className="h-4 w-4 text-brand" aria-hidden /> Miyembro kada Purok</p>
        {!c.loading && !c.failed && <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-extrabold text-brand">{c.total} lahat · {c.verified} verified</span>}
      </div>
      {c.loading ? (
        <Spinner />
      ) : c.failed ? (
        <p className="text-sm text-red-700">Hindi ma-load ang bilang. Subukan ulit mamaya.</p>
      ) : (
        <ul className="space-y-1.5">
          {c.rows.map((r) => (
            <li key={r.purok} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{r.purok}</span>
                <span className="text-gray-700"><b>{r.members}</b> miyembro · <span className="text-brand">{r.verified} verified</span></span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden>
                <div className="h-full rounded-full bg-brand" style={{ width: `${(r.members / max) * 100}%` }} />
              </div>
            </li>
          ))}
          {c.noPurok > 0 && <li className="flex justify-between text-sm text-gray-600"><span>Walang purok</span><span><b>{c.noPurok}</b> miyembro</span></li>}
        </ul>
      )}
    </Card>
  );
}
