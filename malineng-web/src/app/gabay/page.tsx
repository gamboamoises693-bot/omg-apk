"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { GuideSheet } from "@/components/HowTo";
import { useLang } from "@/lib/i18n";
import { GUIDES, guideGroups, type Guide } from "@/lib/guides";

/** "Mga gabay": every how-to guide in one list, for people who want to learn a service before they open it. */
export default function GabayPage() {
  const { lang } = useLang();
  const t = (tl: string, en: string) => (lang === "en" ? en : tl);
  const [open, setOpen] = useState<Guide | null>(null);

  return (
    <div>
      <PageHeader title={t("Mga gabay", "Guides")} subtitle={t("Paano gamitin ang bawat serbisyo", "How to use each service")} />
      {GUIDES.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-gray-600 shadow-card">{t("Malapit na ang mga gabay.", "Guides are coming soon.")}</p>
      ) : (
        <div className="space-y-4">
          {guideGroups().map(({ group, guides }) => (
            <section key={group}>
              <h2 className="mb-1.5 px-1 text-[0.68rem] font-bold uppercase tracking-wider text-gray-500">{group}</h2>
              <div className="overflow-hidden rounded-2xl bg-white shadow-card">
                {guides.map((g) => (
                  <button key={g.id} type="button" onClick={() => setOpen(g)} className="flex w-full items-center gap-3 border-b border-gray-100 px-3 py-3 text-left last:border-0 active:bg-gray-50">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand"><HelpCircle className="h-5 w-5" aria-hidden /></span>
                    <span className="min-w-0 flex-1 font-semibold">{t(g.title.tl, g.title.en)}</span>
                    <span className="shrink-0 text-xs text-gray-500">{t(`${g.steps.length} hakbang`, `${g.steps.length} steps`)}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {open && <GuideSheet guide={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
