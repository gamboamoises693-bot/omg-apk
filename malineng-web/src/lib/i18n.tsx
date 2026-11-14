"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyLanguage } from "@/lib/domTranslate";

export type Lang = "fil" | "en";
const KEY = "malineng-lang";

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
}
const LangContext = createContext<Ctx>({ lang: "fil", setLang: () => {} });

export function useLang(): Ctx {
  return useContext(LangContext);
}

/**
 * Tagalog (default) or English, remembered on this phone. The page is first drawn in Tagalog and switches
 * to English right after loading when the person chose English.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fil");

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "en") setLangState("en");
    } catch {
      /* storage blocked: stays Tagalog */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "fil";
    applyLanguage(lang);
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
