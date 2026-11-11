import { useId } from "react";

// Hexagon outline points (pointy-top, centred at 100,100, radius 90) in a 200x200 viewBox.
const HEX_POINTS = Array.from({ length: 6 }, (_, i) => {
  const angle = ((60 * i - 90) * Math.PI) / 180;
  return `${(100 + 90 * Math.cos(angle)).toFixed(1)},${(100 + 90 * Math.sin(angle)).toFixed(1)}`;
}).join(" ");

/**
 * The default Barangay Malineng mark: the official seal inside a navy + gold hexagon,
 * with a gold "MG" plate underneath. Used wherever no logo was uploaded (and for guests).
 * `size` is a Tailwind size such as "h-9 w-9".
 */
export function MgMark({ size = "h-9 w-9", className = "" }: { size?: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 200 200" className={`${size} shrink-0 ${className}`} role="img" aria-label="Logo ng Barangay Malineng">
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1D5499" />
          <stop offset="1" stopColor="#0B2B57" />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F3DB85" />
          <stop offset=".5" stopColor="#D4AF37" />
          <stop offset="1" stopColor="#9A7B12" />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <circle cx="100" cy="92" r="60" />
        </clipPath>
      </defs>
      <polygon points={HEX_POINTS} fill={`url(#${id}b)`} stroke={`url(#${id}g)`} strokeWidth="7" strokeLinejoin="round" />
      <image href="/seal.png" x="40" y="32" width="120" height="120" clipPath={`url(#${id}c)`} preserveAspectRatio="xMidYMid slice" />
      <circle cx="100" cy="92" r="60" fill="none" stroke={`url(#${id}g)`} strokeWidth="3" />
      <rect x="62" y="140" width="76" height="30" rx="15" fill="#0B2B57" stroke={`url(#${id}g)`} strokeWidth="3" />
      <text x="100" y="161.6" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="24" letterSpacing="-1" fill={`url(#${id}g)`}>
        MG
      </text>
    </svg>
  );
}
