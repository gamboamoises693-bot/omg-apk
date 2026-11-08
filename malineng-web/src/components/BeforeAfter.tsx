"use client";

import { useState } from "react";

/**
 * Drag-to-compare: the "after" photo is revealed over the "before" photo.
 * Uses a native range input, so it works with touch, mouse and keyboard.
 */
export function BeforeAfter({ before, after, alt }: { before: string; after: string; alt: string }) {
  const [pos, setPos] = useState(50);

  return (
    <div className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-2xl bg-gray-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt={`${alt} (before)`} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={`${alt} (after)`} className="h-full w-full object-cover" draggable={false} />
      </div>

      <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white">BEFORE</span>
      <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white">AFTER</span>

      {/* Divider + handle */}
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }}>
        <span className="absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-sm font-black text-brand shadow-lg">⇆</span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        // Vertical swipes still scroll the page; horizontal drags move the slider.
        style={{ touchAction: "pan-y" }}
        aria-label="Hilahin para ikumpara ang before at after"
      />
    </div>
  );
}
