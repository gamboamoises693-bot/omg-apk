/**
 * Kapitan, Secretary and the Developer land on the Dashboard right after they log in.
 * The login page leaves a one-time flag (only when no other page asked for a redirect);
 * OfficerLanding reads it once the profile is known.
 */
const KEY = "malineng.officerLanding";

export function markFreshLogin(): void {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* Storage blocked: the person simply lands on Home. */
  }
}

/** True once per login; the flag is cleared when read. */
export function takeFreshLogin(): boolean {
  try {
    const on = sessionStorage.getItem(KEY) === "1";
    if (on) sessionStorage.removeItem(KEY);
    return on;
  } catch {
    return false;
  }
}

/** Peek without clearing (so the flag survives until the profile has loaded). */
export function hasFreshLogin(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
