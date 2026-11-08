import { collection, doc, getCountFromServer, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Public member counts (stats/public). The users list itself is private, so an admin's
 * browser counts it (aggregation query = cheap: ~1 read per 1,000 docs) and publishes
 * only the numbers. Call from admin-only code.
 */
export async function refreshPublicStats(): Promise<void> {
  const [members, verified, households] = await Promise.all([
    getCountFromServer(collection(db, "users")),
    getCountFromServer(collection(db, "verifiedUsers")),
    getCountFromServer(collection(db, "households")),
  ]);
  await setDoc(
    doc(db, "stats", "public"),
    {
      members: members.data().count,
      verified: verified.data().count,
      households: households.data().count,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Fire-and-forget refresh after an admin action that changes the counts. */
export function refreshPublicStatsQuietly(): void {
  refreshPublicStats().catch((err) => console.warn("[stats] refresh failed:", err));
}

export interface PublicStats {
  members: number;
  verified: number;
  households: number;
}
