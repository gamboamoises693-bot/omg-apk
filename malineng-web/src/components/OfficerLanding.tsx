"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { hasFreshLogin, takeFreshLogin } from "@/lib/officerLanding";

/** Sends an officer to the Dashboard once, right after logging in. Everyone else is left where they are. */
export function OfficerLanding() {
  const router = useRouter();
  const { user, profile, loading, isOfficer } = useAuth();

  useEffect(() => {
    if (loading || !user || !profile || !hasFreshLogin()) return;
    takeFreshLogin();
    if (isOfficer) {
      router.replace("/admin/#dashboard");
      // The page it came from may have been scrolled: start the Dashboard at the top.
      setTimeout(() => window.scrollTo({ top: 0 }), 50);
    }
  }, [loading, user, profile, isOfficer, router]);

  return null;
}
