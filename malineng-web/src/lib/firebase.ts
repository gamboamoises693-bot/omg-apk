import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
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
export const storage: FirebaseStorage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith("PALITAN");
