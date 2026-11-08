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
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "PALITAN-API-KEY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "PALITAN.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "PALITAN-PROJECT-ID",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "PALITAN.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "000000000000",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:000000000000:web:0000000000000000",
};

/**
 * true  = i-upload ang photos sa Firebase Storage (kailangan naka-enable ang Storage).
 * false = i-save ang compressed photo diretso sa Firestore (100% libre, walang Storage).
 * Kahit true ito, automatic na babalik sa Firestore mode kapag pumalya ang Storage.
 */
export const USE_FIREBASE_STORAGE = true;
