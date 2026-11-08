import { Phone } from "lucide-react";
import { telHref } from "@/lib/format";
import type { Hotline } from "@/lib/types";

/** Municipal / national hotlines from settings.hotlines. Each number gets its own call button. */
export function HotlineList({ hotlines }: { hotlines: Hotline[] }) {
  if (hotlines.length === 0) return null;
  return (
    <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
      {hotlines.map((h, i) => (
        <li key={`${h.name}-${i}`} className="p-4">
          <p className="font-bold leading-tight">{h.name}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {h.numbers.map((n) => (
              <a
                key={n}
                href={telHref(n)}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 font-bold tabular-nums text-white active:bg-red-700"
                aria-label={`Tawagan ang ${h.name}: ${n}`}
              >
                <Phone className="h-4 w-4" aria-hidden /> {n}
              </a>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
