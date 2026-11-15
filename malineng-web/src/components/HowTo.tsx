"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, HelpCircle, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { guideById, guideFor, type Guide } from "@/lib/guides";

/** Text in the language the resident chose. The guides carry both languages, so the page translator is not needed here. */
function useT() {
  const { lang } = useLang();
  return (tl: string, en: string) => (lang === "en" ? en : tl);
}

/**
 * The step-by-step guide: one screenshot from the real app per step, with a red circle on what to press.
 * Swipe or use the buttons. Closes with Escape, the X, or a tap outside.
 */
export function GuideSheet({ guide, onClose }: { guide: Guide; onClose: () => void }) {
  const t = useT();
  const [i, setI] = useState(0);
  const touchX = useRef<number | null>(null);
  const last = guide.steps.length - 1;
  const step = guide.steps[Math.min(i, last)];

  const go = useCallback((n: number) => setI(Math.max(0, Math.min(last, n))), [last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((n) => Math.min(last, n + 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, last]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose} role="dialog" aria-modal="true" aria-label={t(guide.title.tl, guide.title.en)}>
      <div
        className="flex max-h-[94dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-[1.75rem] bg-white p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-gray-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          touchX.current = null;
          if (start === null) return;
          const dx = e.changedTouches[0].clientX - start;
          if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
        }}
      >
        <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-gray-200 sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-extrabold leading-snug text-brand-deep">{t(guide.title.tl, guide.title.en)}</h2>
          <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-gray-100 p-1.5 active:bg-gray-200" aria-label={t("Isara", "Close")}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs font-bold tracking-wide text-gray-500">{t(`HAKBANG ${i + 1} NG ${guide.steps.length}`, `STEP ${i + 1} OF ${guide.steps.length}`)}</p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={step.img}
          src={`/guides/${step.img}`}
          width={step.w}
          height={step.h}
          alt={t("Larawan mula sa app para sa hakbang na ito", "Screenshot from the app for this step")}
          className="mx-auto max-h-[52dvh] w-auto max-w-full rounded-2xl border border-gray-200 object-contain"
        />
        <p className="text-[0.97rem] leading-relaxed">{t(step.tl, step.en)}</p>

        <div className="flex justify-center gap-1.5" aria-hidden>
          {guide.steps.map((_, n) => (
            <span key={n} className={`h-2 rounded-full transition-all ${n === i ? "w-5 bg-brand" : "w-2 bg-gray-300"}`} />
          ))}
        </div>
        <div className="grid grid-cols-[1fr_1.4fr] gap-2">
          <button type="button" onClick={() => go(i - 1)} className={`flex items-center justify-center gap-1 rounded-xl bg-gray-100 py-3 text-sm font-extrabold active:bg-gray-200 ${i === 0 ? "invisible" : ""}`}>
            <ChevronLeft className="h-4 w-4" aria-hidden /> {t("Balik", "Back")}
          </button>
          {i < last ? (
            <button type="button" onClick={() => go(i + 1)} className="flex items-center justify-center gap-1 rounded-xl bg-brand py-3 text-sm font-extrabold text-white active:bg-brand-dark">
              {t("Susunod", "Next")} <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <button type="button" onClick={onClose} className="rounded-xl bg-brand py-3 text-sm font-extrabold text-white active:bg-brand-dark">
              {t("Tapos na", "Done")}
            </button>
          )}
        </div>
        <Link href="/gabay/" onClick={onClose} className="text-center text-xs font-bold text-brand underline">
          {t("Tingnan ang iba pang gabay", "See the other guides")}
        </Link>
      </div>
    </div>
  );
}

/**
 * The gold "Paano gamitin" button. It looks at the page the resident is on (or the `id` it was given) and shows only when there is a guide,
 * so every page gets it just by being in the guide list (src/data/guides.json).
 */
export function HowToButton({ className = "", id }: { className?: string; id?: string }) {
  const pathname = usePathname() ?? "/";
  const t = useT();
  // `id` picks a guide directly (the Admin page, where one address holds many sections); otherwise the page decides.
  const guide = id ? guideById(id) : guideFor(pathname);
  const [open, setOpen] = useState(false);
  // Close when the page changes.
  useEffect(() => setOpen(false), [pathname, id]);
  if (!guide) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-xs font-extrabold text-[#3B2E05] shadow-[0_2px_0_rgba(0,0,0,.2)] active:translate-y-px ${className}`}
        aria-label={t("Paano gamitin ang page na ito", "How to use this page")}
      >
        <HelpCircle className="h-4 w-4" aria-hidden /> {t("Paano gamitin", "How to")}
      </button>
      {open && <GuideSheet guide={guide} onClose={() => setOpen(false)} />}
    </>
  );
}
