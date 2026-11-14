"use client";

import { useLang } from "@/lib/i18n";

/** Tagalog / English switch. `dark` is for the navy bars. */
export function LanguageToggle({ dark = false, className = "" }: { dark?: boolean; className?: string }) {
  const { lang, setLang } = useLang();
  const base = "px-2.5 py-1 text-[0.7rem] font-extrabold transition-colors";
  const on = dark ? "bg-gold text-brand-deep" : "bg-brand text-white";
  const off = dark ? "text-white/80" : "text-gray-600";
  return (
    <div role="group" aria-label="Wika / Language" className={`inline-flex overflow-hidden rounded-full ${dark ? "bg-white/15" : "bg-gray-100"} ${className}`}>
      <button type="button" onClick={() => setLang("fil")} aria-pressed={lang === "fil"} className={`${base} ${lang === "fil" ? on : off}`}>TL</button>
      <button type="button" onClick={() => setLang("en")} aria-pressed={lang === "en"} className={`${base} ${lang === "en" ? on : off}`}>EN</button>
    </div>
  );
}
