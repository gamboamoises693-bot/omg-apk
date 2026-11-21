"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Light or dark look of the Kapitan's dashboard (remembered on this phone).
 * In dark mode the big numbers are drawn as dot-matrix (LED) digits; see DotNum.
 */
const KEY = "malineng.dashTheme";

interface Ctx {
  dark: boolean;
  toggle: () => void;
}
const DashCtx = createContext<Ctx>({ dark: false, toggle: () => {} });

export function useDash(): Ctx {
  return useContext(DashCtx);
}

export function DashThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "dark") setDark(true);
    } catch {
      /* storage blocked: stays light */
    }
  }, []);

  const toggle = useCallback(() => {
    setDark((d) => {
      try {
        localStorage.setItem(KEY, d ? "light" : "dark");
      } catch {
        /* ignore */
      }
      return !d;
    });
  }, []);

  return <DashCtx.Provider value={{ dark, toggle }}>{children}</DashCtx.Provider>;
}

/* 5 x 7 dot-matrix digits ("1" = lit dot). Drawn as SVG so nothing has to be downloaded. */
const GLYPH: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

/** True when every character of `text` has a dot-matrix glyph. */
export const canDot = (text: string): boolean => text.length > 0 && text.length <= 8 && [...text].every((c) => c in GLYPH);

/** The text as lit dots: height is 1em (so it follows the font size around it), colour is the text colour. */
export function DotNum({ text }: { text: string }) {
  const chars = [...text];
  const w = chars.length * 6 - 1;
  const dots: ReactNode[] = [];
  chars.forEach((c, ci) => {
    GLYPH[c].forEach((row, y) => {
      [...row].forEach((bit, x) => {
        dots.push(<circle key={`${ci}-${y}-${x}`} cx={ci * 6 + x + 0.5} cy={y + 0.5} r={0.4} fillOpacity={bit === "1" ? 1 : 0.13} />);
      });
    });
  });
  return (
    <svg viewBox={`0 0 ${w} 7`} role="img" aria-label={text} fill="currentColor" style={{ height: "0.92em", width: `${(w / 7) * 0.92}em`, display: "inline-block", verticalAlign: "-0.04em" }}>
      {dots}
    </svg>
  );
}

/** A big number: plain text in the light look, dot-matrix in the dark look (when the characters allow it). */
export function Num({ children }: { children: ReactNode }) {
  const { dark } = useDash();
  const text = typeof children === "string" || typeof children === "number" ? String(children) : null;
  if (dark && text !== null && canDot(text)) return <DotNum text={text} />;
  return <>{children}</>;
}
