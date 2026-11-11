import { useId } from "react";

/**
 * The default Barangay Malineng mark: a navy disc with a gold ring and the "MG" monogram.
 * Used wherever no logo was uploaded (and for guests). `size` is a Tailwind size such as "h-9 w-9".
 */
export function MgMark({ size = "h-9 w-9", className = "" }: { size?: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 100" className={`${size} shrink-0 ${className}`} role="img" aria-label="Logo ng Barangay Malineng">
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
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${id}b)`} />
      <circle cx="50" cy="50" r="42" fill="none" stroke={`url(#${id}g)`} strokeWidth="3.2" />
      <path d="M50 16.5l2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7z" fill={`url(#${id}g)`} />
      <text x="50" y="62" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="35" letterSpacing="-1.5" fill={`url(#${id}g)`}>
        MG
      </text>
      <rect x="37" y="68" width="26" height="1.6" rx=".8" fill={`url(#${id}g)`} />
    </svg>
  );
}
