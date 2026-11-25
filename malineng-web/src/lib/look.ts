"use client";

/**
 * Site look: "glass" (dark frosted glass, the default) or "klasiko" (the earlier light look).
 * The glass look is used on every page while the Christmas look is off; during Christmas the
 * seasonal look always wins. Residents can pick Klasiko on their own phone (Account).
 *
 * <html data-look="glass"|"classic"> drives the CSS in globals.css. A tiny boot script sets it before
 * the first paint, using the saved choice and the last known Christmas state, so there is no flash.
 */
export type LookPref = "glass" | "klasiko";

const PREF_KEY = "malineng.look";
const XMAS_KEY = "malineng.xmasOn";
const SITE_KEY = "malineng.siteLook";
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
export function rememberSite(xmasOn: boolean, siteLook: "glass" | "classic"): void {
  try {
    localStorage.setItem(XMAS_KEY, xmasOn ? "1" : "0");
    localStorage.setItem(SITE_KEY, siteLook);
  } catch {
    /* ignore */
  }
}

/** The look to show now: Christmas wins, then the Developer's choice, then the resident's own choice. */
export function resolveLook(xmas: boolean, siteLook: "glass" | "classic", pref: LookPref): "glass" | "classic" {
  return !xmas && siteLook === "glass" && pref === "glass" ? "glass" : "classic";
}

/** Runs in <head> before the first paint. Plain ES5 on purpose. */
export const LOOK_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem("${PREF_KEY}");var x=localStorage.getItem("${XMAS_KEY}")==="1";var l=localStorage.getItem("${SITE_KEY}");document.documentElement.setAttribute("data-look",(!x&&l!=="classic"&&p!=="klasiko")?"glass":"classic");}catch(e){document.documentElement.setAttribute("data-look","glass");}})();`;
