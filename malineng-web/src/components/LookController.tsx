"use client";

import { useEffect } from "react";
import { useTheme, useXmas } from "@/lib/theme";
import { LOOK_EVENT, getLookPref, rememberSite, resolveLook } from "@/lib/look";

/** Keeps <html data-look> in step with the Christmas setting and the resident's choice. Renders nothing. */
export function LookController() {
  const xmas = useXmas();
  const siteLook = useTheme().look;

  useEffect(() => {
    rememberSite(xmas, siteLook);
    const apply = () => document.documentElement.setAttribute("data-look", resolveLook(xmas, siteLook, getLookPref()));
    apply();
    window.addEventListener(LOOK_EVENT, apply);
    return () => window.removeEventListener(LOOK_EVENT, apply);
  }, [xmas, siteLook]);

  return null;
}
