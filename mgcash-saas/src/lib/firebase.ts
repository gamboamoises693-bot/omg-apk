import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
  type Auth,
} from "firebase/auth";
import {
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const useEmulators = import.meta.env.VITE_USE_EMULATORS === "true";

if (!config.projectId) {
  // Fail loud in dev instead of silent permission errors later.
  console.error("[MG-CASH] Missing Firebase config. Copy .env.example to .env and fill it in.");
}

export const app: FirebaseApp = initializeApp(config);
export const auth: Auth = getAuth(app);
export const db: Firestore = initializeFirestore(app, {
  // Offline cache: tindera keeps working on spotty signal; writes sync later.
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const functions = getFunctions(app, "asia-southeast1");

if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

/**
 * Create an Auth user WITHOUT signing out the current user (Store Owner adding a Tindera).
 * Uses a throwaway secondary app instance, so no Cloud Functions / Blaze plan needed.
 * If `afterCreate` (e.g. the Firestore profile write) fails, the new Auth user is deleted
 * so the username can be reused.
 */
export async function createUserSilently(
  email: string,
  password: string,
  afterCreate: (uid: string) => Promise<void>,
): Promise<string> {
  const secondary = initializeApp(config, `secondary-${Date.now()}`);
  try {
    const secAuth = getAuth(secondary);
    if (useEmulators) connectAuthEmulator(secAuth, "http://127.0.0.1:9099", { disableWarnings: true });
    const cred = await createUserWithEmailAndPassword(secAuth, email, password);
    try {
      await afterCreate(cred.user.uid);
    } catch (e) {
      await deleteUser(cred.user).catch(() => undefined);
      throw e;
    }
    await signOut(secAuth);
    return cred.user.uid;
  } finally {
    await deleteApp(secondary);
  }
}
