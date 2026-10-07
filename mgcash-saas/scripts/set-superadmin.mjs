// One-time setup: give an existing Firebase Auth user the `superadmin` custom claim.
//
// 1. Firebase Console > Authentication > Add user (e.g. moises@yourdomain.com + strong password)
// 2. Firebase Console > Project settings > Service accounts > Generate new private key
//    Save as ./service-account.json (git-ignored, NEVER commit it)
// 3. npm install (firebase-admin is a devDependency)
// 4. node scripts/set-superadmin.mjs moises@yourdomain.com
//
// Remove access:  node scripts/set-superadmin.mjs moises@yourdomain.com --revoke
import { readFile } from "node:fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error("Usage: node scripts/set-superadmin.mjs <email> [--revoke]");
  process.exit(1);
}

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "./service-account.json";
const serviceAccount = JSON.parse(await readFile(keyPath, "utf8"));
initializeApp({ credential: cert(serviceAccount) });

try {
  const user = await getAuth().getUserByEmail(email);
  const revoke = flag === "--revoke";
  await getAuth().setCustomUserClaims(user.uid, revoke ? { superadmin: null } : { ...(user.customClaims ?? {}), superadmin: true });
  console.log(`${revoke ? "Revoked" : "Granted"} superadmin for ${email} (uid ${user.uid}). User must log out and in again.`);
} catch (e) {
  console.error("Failed:", e.message);
  process.exit(1);
}
