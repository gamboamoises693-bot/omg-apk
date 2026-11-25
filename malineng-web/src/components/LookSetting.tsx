"use client";

import { useEffect, useState } from "react";
import { getLookPref, setLookPref, type LookPref } from "@/lib/look";
import { useXmas } from "@/lib/theme";

const OPTIONS: { key: LookPref; label: string; hint: string }[] = [
  { key: "glass", label: "Glass", hint: "Madilim, makinis" },
  { key: "klasiko", label: "Klasiko", hint: "Maliwanag" },
];

/** Account setting: glass (dark) or classic (light) look, per phone. Christmas always uses its own look. */
export function LookSetting() {
  const [pref, setPref] = useState<LookPref>("glass");
  const xmas = useXmas();
  useEffect(() => setPref(getLookPref()), []);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Itsura ng website">
        {OPTIONS.map((o) => {
          const on = pref === o.key;
          return (
            <button
              key={o.key}
              role="radio"
              aria-checked={on}
              onClick={() => {
                setLookPref(o.key);
                setPref(o.key);
              }}
              className={`flex flex-col items-center gap-0.5 rounded-xl border py-3 ${on ? "border-brand bg-brand-light text-brand" : "border-gray-200 bg-white text-gray-600"}`}
            >
              <span className="text-sm font-extrabold">{o.label}</span>
              <span className="text-xs font-medium">{o.hint}</span>
            </button>
          );
        })}
      </div>
      {xmas && <p className="mt-2 text-xs text-gray-500">Ngayong Pasko, ang Pasko na itsura ang gamit. Babalik ang napili mo pagkatapos ng season.</p>}
    </div>
  );
}
