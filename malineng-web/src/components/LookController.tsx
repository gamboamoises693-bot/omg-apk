"use client";

import { useEffect } from "react";
import { useXmas } from "@/lib/theme";
import { LOOK_EVENT, getLookPref, rememberXmas, resolveLook } from "@/lib/look";

/** Keeps <html data-look> in step with the Christmas setting and the resident's choice. Renders nothing. */
export function LookController() {
  const xmas = useXmas();

  useEffect(() => {
    rememberXmas(xmas);
    const apply = () => document.documentElement.setAttribute("data-look", resolveLook(xmas, getLookPref()));
    apply();
    window.addEventListener(LOOK_EVENT, apply);
    return () => window.removeEventListener(LOOK_EVENT, apply);
  }, [xmas]);

  return null;
}
