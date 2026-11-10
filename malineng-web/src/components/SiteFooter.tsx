"use client";

import { useEffect, useState } from "react";
import { BARANGAY_CITY, DEVELOPER_NAME, DEVELOPER_URL } from "@/lib/constants";

/** Footer line for Home and Login: barangay, year, and who built the site. */
export function SiteFooter({ className = "" }: { className?: string }) {
  // Computed in the browser: the static build would otherwise freeze the build-time year.
  const [year, setYear] = useState(2026);
  useEffect(() => setYear(new Date().getFullYear()), []);
  return (
    <footer className={`text-center ${className}`}>
      <div className="mb-2.5 flex items-center justify-center gap-2" aria-hidden>
        <span className="h-px w-14 bg-gray-200" />
        <span className="h-1.5 w-1.5 rounded-full bg-gold" />
        <span className="h-px w-14 bg-gray-200" />
      </div>
      <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.18em] text-brand-deep">Barangay Malineng</p>
      <p className="mt-0.5 text-xs text-gray-500">© {year} · {BARANGAY_CITY}</p>
      <p className="mt-1.5 text-xs text-gray-400">
        Developed by{" "}
        {DEVELOPER_URL ? (
          <a href={DEVELOPER_URL} target="_blank" rel="noopener noreferrer" className="font-bold text-brand underline-offset-2 active:underline">
            {DEVELOPER_NAME}
          </a>
        ) : (
          <b className="font-bold text-brand">{DEVELOPER_NAME}</b>
        )}
      </p>
    </footer>
  );
}
