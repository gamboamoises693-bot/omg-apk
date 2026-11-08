import { BadgeCheck } from "lucide-react";

/** Small blue check shown next to the name of a selfie-verified resident. */
export function VerifiedBadge({ show, className = "" }: { show: boolean; className?: string }) {
  if (!show) return null;
  return (
    <span className={`inline-flex items-center text-blue-600 ${className}`} title="Verified na residente" aria-label="Verified na residente">
      <BadgeCheck className="h-[1.05em] w-[1.05em]" aria-hidden />
    </span>
  );
}
