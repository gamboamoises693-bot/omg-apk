"use client";

import type { ReactNode } from "react";
import { LogoMark } from "./BarangayLogo";
import { useXmas } from "@/lib/theme";
import { XmasLights, XmasSnow, XmasStar } from "./Xmas";

/** Navy welcome band for Login and Register: seal, barangay name in gold capitals, title and subtitle. Festive at Christmas. */
export function AuthHero({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  const xmas = useXmas();
  return (
    <div className={`relative -mx-4 -mt-4 overflow-hidden rounded-b-[2rem] px-5 pb-16 text-center text-white ${xmas ? "xmas-card pt-11" : "bg-gradient-to-br from-brand-dark to-brand-deep pt-8"}`}>
      {xmas && (
        <>
          <XmasLights />
          <XmasSnow />
        </>
      )}
      <div className="relative flex justify-center">
        <LogoMark size="h-16 w-16" textClass="text-2xl" />
      </div>
      <p className="relative mt-3 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-gold">Barangay Malineng</p>
      {xmas && (
        <p className="relative mx-auto mt-2 flex w-fit items-center gap-1.5 rounded-full bg-[#B3202B] px-3 py-1 text-[0.68rem] font-extrabold tracking-widest shadow-[0_2px_0_rgba(0,0,0,.25)]">
          <XmasStar className="h-3.5 w-3.5 fill-gold" /> MALIGAYANG PASKO
        </p>
      )}
      <h1 className="relative mt-2 text-[1.6rem] font-extrabold leading-tight tracking-tight">{title}</h1>
      <p className="relative mx-auto mt-1.5 max-w-xs text-[0.85rem] text-white/75">{subtitle}</p>
      {children}
      <div className="pointer-events-none absolute inset-x-8 bottom-0 h-[3px] rounded-full bg-gradient-to-r from-transparent via-gold to-transparent opacity-80" aria-hidden />
    </div>
  );
}
