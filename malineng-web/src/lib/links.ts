/**
 * Cleans a pasted Facebook page or website. "facebook.com/omega" becomes "https://facebook.com/omega".
 * Only http and https links with a real host are kept (never javascript: or anything else); anything else gives "".
 */
export function normalizeLink(raw: string): string {
  const t = raw.trim().slice(0, 300);
  if (!t) return "";
  const withScheme = /^https?:\/\//i.test(t) ? t : /^[a-z][a-z0-9+.-]*:/i.test(t) ? "" : `https://${t}`;
  if (!withScheme) return "";
  try {
    const u = new URL(withScheme);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".") ? u.toString() : "";
  } catch {
    return "";
  }
}

/** "https://www.facebook.com/omega" -> "facebook.com" (shown under the sponsor so people know where the tap goes). */
export function linkHost(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Facebook paths that are not a page's own name, so there is no Messenger chat to open. */
const NOT_A_PAGE = new Set(["profile.php", "groups", "events", "watch", "share", "sharer", "sharer.php", "story.php", "permalink.php", "photo", "photo.php", "photos", "video", "videos", "reel", "marketplace", "gaming", "login", "dialog", "plugins", "hashtag", "people", "public", "stories", "l.php"]);

/**
 * The Messenger chat of a Facebook page: "https://facebook.com/omegaice" becomes "https://m.me/omegaice".
 * Returns "" when the link is a website, a personal profile (profile.php?id=...), a group, a post or anything
 * else that has no page name, so no Messenger button is shown for it.
 */
export function messengerLink(link: string): string {
  try {
    const u = new URL(link);
    const host = u.hostname.replace(/^(www|m|web|mbasic)\./, "").toLowerCase();
    if (host !== "facebook.com" && host !== "fb.com") return "";
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "";
    let name = parts[0];
    // Old style page address: /pages/Business-Name/123456789 (the number is the page).
    if (name === "pages") name = parts.slice(1).reverse().find((x) => /^\d{5,}$/.test(x)) ?? "";
    if (!name || NOT_A_PAGE.has(name.toLowerCase()) || !/^[A-Za-z0-9.\-]{3,100}$/.test(name)) return "";
    return `https://m.me/${name}`;
  } catch {
    return "";
  }
}
