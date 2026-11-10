import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * The list of verified user ids lives in ONE small document (stats/verifiedSet), so every page that shows
 * a verified badge reads 1 document instead of one per verified resident. Admins keep it in step with
 * verifiedUsers/{uid} (the per-person flag the rules use).
 */
export const verifiedSetRef = () => doc(db, "stats", "verifiedSet");

export const verifiedSetAdd = (uid: string) => ({ uids: arrayUnion(uid) });
export const verifiedSetRemove = (uid: string) => ({ uids: arrayRemove(uid) });

/** Admin: build the document from verifiedUsers when it does not exist yet (one-time migration). */
export async function ensureVerifiedSet(): Promise<void> {
  const existing = await getDoc(verifiedSetRef());
  if (existing.exists()) return;
  const snap = await getDocs(collection(db, "verifiedUsers"));
  await setDoc(verifiedSetRef(), { uids: snap.docs.map((d) => d.id) });
}
