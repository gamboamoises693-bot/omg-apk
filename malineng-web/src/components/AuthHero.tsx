import type { ReactNode } from "react";
import { LogoMark } from "./BarangayLogo";

/** Navy welcome band for Login and Register: seal, barangay name in gold capitals, title and subtitle. */
export function AuthHero({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className="relative -mx-4 -mt-4 rounded-b-[2rem] bg-gradient-to-br from-brand-dark to-brand-deep px-5 pb-16 pt-8 text-center text-white">
      <div className="flex justify-center">
        <LogoMark size="h-16 w-16" textClass="text-2xl" />
      </div>
      <p className="mt-3 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-gold">Barangay Malineng</p>
      <h1 className="mt-1 text-[1.6rem] font-extrabold leading-tight tracking-tight">{title}</h1>
      <p className="mx-auto mt-1.5 max-w-xs text-[0.85rem] text-white/75">{subtitle}</p>
      {children}
      <div className="pointer-events-none absolute inset-x-8 bottom-0 h-[3px] rounded-full bg-gradient-to-r from-transparent via-gold to-transparent opacity-80" aria-hidden />
    </div>
  );
}
