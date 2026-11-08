"use client";

import { useEffect } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { deleteCutoff, deleteListing } from "@/lib/listings";
import { logActivity } from "@/lib/activity";
import { refreshPublicStatsQuietly } from "@/lib/stats";

const SESSION_KEY = "malineng-listing-cleanup";

/**
 * Free-plan "cron": when any admin opens the site (once per browser session), delete
 * listings whose 24 hours ended more than a day ago. Keeps the database small.
 */
export function ListingHousekeeping() {
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (!isAdmin) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* storage blocked: may run more than once, which is harmless */
    }
    // Keep the public member count on Home fresh.
    refreshPublicStatsQuietly();
    (async () => {
      try {
        const old = await getDocs(query(collection(db, "listings"), where("expiresAt", "<", deleteCutoff()), limit(200)));
        if (old.empty) return;
        await Promise.all(old.docs.map((d) => deleteListing(d.id)));
        logActivity("Tindahan", `Auto-delete: ${old.size} paninda na lampas na sa 24 oras`);
      } catch (err) {
        console.warn("[housekeeping] listing cleanup failed:", err);
      }
    })();
  }, [isAdmin]);

  return null;
}
