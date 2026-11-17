/**
 * "Irehistro ngayon" on a portal request opens Admin → Rehistro sa Hall with the name, contact and purok already filled in.
 * The details travel in sessionStorage (this tab only); the request is removed after the resident is registered.
 */
const KEY = "malineng-hall-prefill";

export interface HallPrefill {
  fullName: string;
  contact: string;
  purok: string;
  /** portalRequests/{contact} to delete once registered. */
  requestId?: string;
}

export function setHallPrefill(p: HallPrefill): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode: the staff simply types the details */
  }
}

/** Reads and clears the prefill. */
export function takeHallPrefill(): HallPrefill | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as HallPrefill;
  } catch {
    return null;
  }
}
