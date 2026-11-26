"use client";

import { useEffect } from "react";
import { useTheme, useXmas } from "@/lib/theme";
import { LOOK_EVENT, getLookPref, rememberSite, resolveGlass, resolveLook } from "@/lib/look";

/** Keeps <html data-look> in step with the Christmas setting and the resident's choice. Renders nothing. */
export function LookController() {
  const xmas = useXmas();
  const { look: siteLook, glass } = useTheme();

  useEffect(() => {
    rememberSite(xmas, siteLook, glass);
    const apply = () => {
      const root = document.documentElement;
      root.setAttribute("data-look", resolveLook(xmas, siteLook, getLookPref()));
      root.setAttribute("data-glass", resolveGlass(xmas, glass));
    };
    apply();
    window.addEventListener(LOOK_EVENT, apply);
    return () => window.removeEventListener(LOOK_EVENT, apply);
  }, [xmas, siteLook, glass]);

  return null;
}
