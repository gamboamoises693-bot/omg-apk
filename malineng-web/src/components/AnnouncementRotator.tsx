"use client";

import { useEffect, useRef, useState } from "react";
import { Megaphone } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { Announcement } from "@/lib/types";

const ROTATE_MS = 10_000;

/**
 * Shows one announcement at a time and switches to the next every 10 seconds.
 * All cards sit in the same grid cell, so the box keeps the height of the tallest one (nothing jumps),
 * and only the current card is visible. Tap a dot, or swipe, to move by hand; the timer restarts after that.
 * It pauses while a finger is on the card and while the tab is hidden.
 */
export function AnnouncementRotator({ items }: { items: Announcement[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = items.length;
  // If the list gets shorter (an announcement was removed), never point past the end.
  const current = count ? Math.min(index, count - 1) : 0;

  // The timer restarts whenever the card changes (also after a manual change), so a tap never gets cut short.
  useEffect(() => {
    if (count < 2 || paused) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearTimeout(t);
  }, [count, paused, current]);

  // Do not rotate in the background; resume when the tab is visible again.
  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (count === 0) return null;

  const go = (i: number) => setIndex(((i % count) + count) % count);

  return (
    <div
      className="space-y-2"
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        setPaused(false);
        if (start === null) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
      }}
      onTouchCancel={() => setPaused(false)}
    >
      <div className="grid" aria-live="off">
        {items.map((a, i) => {
          const active = i === current;
          return (
            <article
              key={`${a.title}-${i}`}
              aria-hidden={!active}
              className={`col-start-1 row-start-1 flex min-h-[7rem] flex-col justify-between rounded-2xl p-4 transition-opacity duration-500 motion-reduce:transition-none ${
                i % 2 === 0 ? "bg-gradient-to-br from-brand to-brand-deep text-white" : "bg-gradient-to-br from-gold to-gold-dark text-brand-deep"
              } ${active ? "opacity-100" : "pointer-events-none opacity-0"}`}
            >
              <p className="flex items-center gap-1 text-[0.7rem] font-bold uppercase tracking-wide opacity-80">
                <Megaphone className="h-3.5 w-3.5" aria-hidden /> {a.date ? formatDate(a.date) : "Anunsyo"}
              </p>
              <p className="mt-1 font-bold leading-snug">{a.title}</p>
              {a.body && <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs opacity-90">{a.body}</p>}
            </article>
          );
        })}
      </div>

      {count > 1 && (
        <div className="flex items-center justify-center gap-2" role="tablist" aria-label="Mga anunsyo">
          {items.map((a, i) => (
            <button
              key={`${a.title}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === current}
              aria-label={`Anunsyo ${i + 1} ng ${count}: ${a.title}`}
              onClick={() => go(i)}
              className="flex h-6 w-6 items-center justify-center"
            >
              <span className={`block h-2 rounded-full transition-all ${i === current ? "w-5 bg-brand" : "w-2 bg-gray-300"}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
