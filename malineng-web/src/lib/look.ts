"use client";

/**
 * Site look: "glass" (dark frosted glass, the default) or "klasiko" (the earlier light look).
 * The Developer picks the site look (Settings): a glass color theme, or Original. Christmas is a glass theme too
 * ("pasko"). Residents can pick Klasiko (the old light look) on their own phone (Account).
 *
 * <html data-look="glass"|"classic" data-glass="midnight|violet|...|pasko"> drives the CSS in globals.css. A tiny boot script sets it before
 * the first paint, using the saved choice and the last known Christmas state, so there is no flash.
 */
export type LookPref = "glass" | "klasiko";

const PREF_KEY = "malineng.look";
const XMAS_KEY = "malineng.xmasOn";
const SITE_KEY = "malineng.siteLook";
const GLASS_KEY = "malineng.glassTheme";
export const LOOK_EVENT = "malineng:look";

export function getLookPref(): LookPref {
  try {
    return localStorage.getItem(PREF_KEY) === "klasiko" ? "klasiko" : "glass";
  } catch {
    return "glass";
  }
}

export function setLookPref(pref: LookPref): void {
  try {
    localStorage.setItem(PREF_KEY, pref);
  } catch {
    /* storage blocked: the choice lasts until the page is closed */
  }
  window.dispatchEvent(new Event(LOOK_EVENT));
}

/** Remembers Christmas and the Developer's look, so the next page load can pick the right look before Firestore answers. */
export function rememberSite(xmasOn: boolean, siteLook: "glass" | "classic", glass: string): void {
  try {
    localStorage.setItem(XMAS_KEY, xmasOn ? "1" : "0");
    localStorage.setItem(SITE_KEY, siteLook);
    localStorage.setItem(GLASS_KEY, glass);
  } catch {
    /* ignore */
  }
}

/** The look to show now: the resident's Klasiko wins, then Christmas (glass), then the Developer's choice. */
export function resolveLook(xmas: boolean, siteLook: "glass" | "classic", pref: LookPref): "glass" | "classic" {
  if (pref === "klasiko") return "classic";
  return xmas || siteLook === "glass" ? "glass" : "classic";
}

/** The glass color theme to use: Christmas has its own. */
export function resolveGlass(xmas: boolean, glass: string): string {
  return xmas ? "pasko" : glass;
}

/** Runs in <head> before the first paint. Plain ES5 on purpose. */
export const LOOK_BOOT_SCRIPT = `(function(){try{var d=document.documentElement;var p=localStorage.getItem("${PREF_KEY}");var x=localStorage.getItem("${XMAS_KEY}")==="1";var l=localStorage.getItem("${SITE_KEY}");var g=localStorage.getItem("${GLASS_KEY}")||"midnight";d.setAttribute("data-look",(p==="klasiko")?"classic":((x||l!=="classic")?"glass":"classic"));d.setAttribute("data-glass",x?"pasko":g);}catch(e){document.documentElement.setAttribute("data-look","glass");}})();`;
