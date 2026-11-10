/**
 * ============================================================
 *  PALITAN MO ITO ng sarili mong Firebase config.
 *  Saan makukuha: Firebase Console > Project settings (gear icon)
 *  > "Your apps" > Web app (</>) > SDK setup and configuration > Config
 *
 *  OK lang na naka-public ito — hindi ito password.
 *  Ang tunay na proteksyon ay ang firestore.rules at storage.rules.
 * ============================================================
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyCnW_dhNhbvVpEwS8lci1Arz_TSgd7jVQM",
  // Google login screen says "to continue to <authDomain>". Using our own short address instead of
  // project-...firebaseapp.com. Needs https://barangay-malineng.web.app/__/auth/handler added as an
  // authorized redirect URI of the Google OAuth web client (see the PR description).
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "barangay-malineng.web.app",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "project-a682ecac-e2d1-469c-bc7",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "project-a682ecac-e2d1-469c-bc7.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "879724247614",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:879724247614:web:889424a89b8b8a6f7f6f6f",
};

/**
 * false (default) = i-save ang compressed photo diretso sa Firestore.
 *                   100% libre, hindi kailangan ng Blaze plan o credit card.
 * true            = i-upload sa Firebase Storage. Sa mga bagong project, kailangan
 *                   ng Blaze plan para ma-enable ang Storage.
 *                   Kapag pumalya ang Storage, babalik pa rin ito sa Firestore mode.
 */
export const USE_FIREBASE_STORAGE = false;
