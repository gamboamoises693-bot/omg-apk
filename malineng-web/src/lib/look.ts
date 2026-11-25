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

/** Remembers whether Christmas was on, so the next page load can pick the right look before Firestore answers. */
export function rememberXmas(on: boolean): void {
  try {
    localStorage.setItem(XMAS_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** The look to show now. */
export function resolveLook(xmas: boolean, pref: LookPref): "glass" | "classic" {
  return !xmas && pref === "glass" ? "glass" : "classic";
}

/** Runs in <head> before the first paint. Plain ES5 on purpose. */
export const LOOK_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem("${PREF_KEY}");var x=localStorage.getItem("${XMAS_KEY}")==="1";document.documentElement.setAttribute("data-look",(!x&&p!=="klasiko")?"glass":"classic");}catch(e){document.documentElement.setAttribute("data-look","glass");}})();`;
