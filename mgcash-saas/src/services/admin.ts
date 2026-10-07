import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";

/**
 * Reset another user's password via Cloud Function (Admin SDK).
 * Super Admin -> any store owner; Store Owner -> own tinderas only (checked server-side).
 * Requires `functions/` deployed (Blaze plan).
 */
export async function resetUserPassword(uid: string, newPassword: string): Promise<void> {
  const fn = httpsCallable<{ uid: string; newPassword: string }, { ok: boolean }>(functions, "resetUserPassword");
  try {
    await fn({ uid, newPassword });
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    if (code.includes("not-found") || code.includes("internal") || code.includes("unavailable")) {
      throw new Error("Hindi pa naka-deploy ang Cloud Functions (resetUserPassword). Tingnan ang README.");
    }
    throw e;
  }
}
