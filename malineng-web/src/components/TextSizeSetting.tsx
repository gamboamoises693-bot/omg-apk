"use client";

import { useEffect, useState } from "react";
import { TEXT_SIZES, getTextSize, setTextSize, type TextSize } from "@/lib/textSize";

const SAMPLE_PX: Record<TextSize, string> = { normal: "text-sm", malaki: "text-base", pinakamalaki: "text-lg" };

/** "Aa" text-size picker (per device). Helpful for senior citizens. */
export function TextSizeSetting() {
  const [size, setSize] = useState<TextSize>("normal");
  useEffect(() => setSize(getTextSize()), []);

  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Laki ng text">
      {TEXT_SIZES.map((t) => {
        const on = size === t.key;
        return (
          <button
            key={t.key}
            role="radio"
            aria-checked={on}
            onClick={() => {
              setTextSize(t.key);
              setSize(t.key);
            }}
            className={`flex flex-col items-center gap-1 rounded-xl border py-3 ${on ? "border-brand bg-brand-light text-brand" : "border-gray-200 bg-white text-gray-600"}`}
          >
            <span className={`font-black ${SAMPLE_PX[t.key]}`}>Aa</span>
            <span className="text-xs font-semibold">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
