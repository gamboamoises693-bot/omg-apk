// OPTIONAL Cloud Functions (requires Firebase Blaze plan).
// The app works without these; only "Reset Password" needs them.
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";

initializeApp();
setGlobalOptions({ region: "asia-southeast1", maxInstances: 5 });

/**
 * resetUserPassword({ uid, newPassword })
 *  - Super Admin: may reset any store owner or tindera.
 *  - Store Owner: may reset only tinderas of her own store.
 */
export const resetUserPassword = onCall(async (req) => {
  const caller = req.auth;
  if (!caller) throw new HttpsError("unauthenticated", "Login required.");

  const { uid, newPassword } = req.data ?? {};
  if (typeof uid !== "string" || !uid) throw new HttpsError("invalid-argument", "uid required.");
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
  }

  const isSuper = caller.token.superadmin === true;
  if (!isSuper) {
    const db = getFirestore();
    const target = await db.doc(`users/${uid}`).get();
    // Owner's store id == owner uid; target must be a tindera of that store.
    const ok = target.exists && target.get("role") === "tindera" && target.get("store_id") === caller.uid;
    if (!ok) throw new HttpsError("permission-denied", "Hindi mo pwedeng i-reset ang account na ito.");
  }

  await getAuth().updateUser(uid, { password: newPassword });
  // Sign the user out everywhere so the old password stops working immediately.
  await getAuth().revokeRefreshTokens(uid);
  return { ok: true };
});
