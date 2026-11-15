import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { APP_CHECK_SITE_KEY, firebaseConfig } from "@/config/firebase.config";

// Reuse the app instance during hot reload / multiple imports.
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// App Check proves that requests come from this website and not from a script that copied the
// public Firebase key. It starts only in the browser and only once a site key is configured.
if (typeof window !== "undefined" && APP_CHECK_SITE_KEY) {
  try {
    initializeAppCheck(app, { provider: new ReCaptchaV3Provider(APP_CHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
  } catch (err) {
    // Already started (hot reload) or blocked: the site keeps working; enforcement is the console's choice.
    console.warn("[app-check] not started:", err);
  }
}

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
// Only for `scripts/guides` (it takes the screenshots of the how-to guides from a copy of the app that talks to the
// local Firebase emulators with sample data). The flag is empty in the real build, so this never runs for residents.
if (process.env.NEXT_PUBLIC_USE_EMULATORS === "1" && typeof window !== "undefined") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
export const storage: FirebaseStorage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith("PALITAN");
