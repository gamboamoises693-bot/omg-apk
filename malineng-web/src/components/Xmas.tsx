import type { CSSProperties } from "react";

const BULB_COLORS = ["#E5393F", "#E0B94A", "#3DBE7A", "#4B9BEA"];

/** A five-point star (used in the ribbon, the garland title and above the main sponsor). */
export function XmasStar({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 9.2l7.1-.6z" />
    </svg>
  );
}

/** A wire of twinkling bulbs along the top edge of a card (decoration only). */
export function XmasLights() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[34px]" aria-hidden>
      <svg viewBox="0 0 400 34" preserveAspectRatio="none" className="block h-full w-full">
        <path d="M0 6 Q50 26 100 8 T200 8 T300 8 T400 6" fill="none" stroke="#1b1b1b" strokeWidth="2" />
        {Array.from({ length: 14 }, (_, i) => (
          <circle
            key={i}
            className="xmas-bulb"
            cx={14 + i * 28.5}
            cy={i % 2 ? 18 : 12}
            r="4.2"
            fill={BULB_COLORS[i % 4]}
            style={{ animationDelay: `${(i % 5) * 0.6}s` } as CSSProperties}
          />
        ))}
      </svg>
    </div>
  );
}

/** Gentle snowfall. Fixed positions (no randomness) so the server and the browser render the same thing. */
export function XmasSnow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 18 }, (_, i) => (
        <i
          key={i}
          className="xmas-flake absolute -top-2 rounded-full bg-white opacity-80"
          style={{
            left: `${(i * 5.7 + (i % 3) * 2) % 100}%`,
            width: 3 + (i % 3),
            height: 3 + (i % 3),
            animationDuration: `${6 + (i % 5) * 1.3}s`,
            animationDelay: `-${(i * 1.7) % 8}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Green garland with red baubles, between the main sponsor and the others. */
export function XmasGarland() {
  return (
    <div className="-mx-4 h-[26px]" aria-hidden>
      <svg viewBox="0 0 400 26" preserveAspectRatio="none" className="block h-full w-full">
        <path d="M0 4 Q25 24 50 6 T100 6 T150 6 T200 6 T250 6 T300 6 T350 6 T400 4" fill="none" stroke="#1d7a52" strokeWidth="5" strokeLinecap="round" />
        <g fill="#B3202B">
          <circle cx="50" cy="8" r="4" /><circle cx="150" cy="8" r="4" /><circle cx="250" cy="8" r="4" /><circle cx="350" cy="8" r="4" />
        </g>
      </svg>
    </div>
  );
}
