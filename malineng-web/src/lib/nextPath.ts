/** Where to go after login when the page asked for it (/login?next=/verify/). Only paths inside this site are accepted. */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "";
  return raw;
}

/** The "next" path of the current address, or "" when there is none. Call it in an event or an effect, not while rendering. */
export function nextFromLocation(): string {
  try {
    return safeNext(new URLSearchParams(window.location.search).get("next"));
  } catch {
    return "";
  }
}

/** The address a resident opens to finish verifying their account (they log in first, then land on the selfie step). */
export const VERIFY_LINK = "https://barangay-malineng.web.app/verify/";

/** Message an admin sends to someone whose account is not verified yet. */
export function verifyInviteText(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return `Kumusta po${first ? `, ${first}` : ""}! Para ma-verify ang account mo sa Barangay Malineng app, buksan ang link na ito, mag-login, at kumuha ng selfie: ${VERIFY_LINK} Kung nahihirapan, pindutin ang "Nahihirapan sa pag-setup?" sa Account.`;
}
