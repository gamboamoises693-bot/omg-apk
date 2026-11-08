"use client";

import type { ReactNode } from "react";
import { BadgeCheck, Ban, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LinkButton, Spinner } from "./ui";
import { LoginGate } from "./LoginGate";

/**
 * Shows children only to verified (selfie-approved), non-suspended users.
 * Matches the rules in firestore.rules (verifiedPoster()).
 */
export function RequireVerified({ children, feature }: { children: ReactNode; feature: string }) {
  const { loading, isVerified, isSuspended, verification } = useAuth();

  return (
    <LoginGate message={`Mag-login para ${feature}.`}>
      {loading ? (
        <Spinner />
      ) : isSuspended ? (
        <div className="rounded-2xl bg-red-50 p-4 text-center text-sm text-red-800">
          <Ban className="mx-auto mb-1 h-7 w-7" />
          <p className="font-bold">Naka-suspend ang account mo.</p>
          <p>Makipag-ugnayan sa Barangay Hall para maayos ito.</p>
        </div>
      ) : isVerified ? (
        <>{children}</>
      ) : verification?.status === "pending" ? (
        <div className="rounded-2xl bg-gold-light p-4 text-center text-sm text-yellow-900">
          <Clock className="mx-auto mb-1 h-7 w-7" />
          <p className="font-bold">Sinusuri pa ng Barangay ang selfie mo.</p>
          <p>Magagamit mo ito kapag na-verify na ang account mo (karaniwang 1 araw).</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-blue-50 p-4 text-center text-sm text-blue-900">
          <BadgeCheck className="mx-auto mb-1 h-7 w-7 text-blue-600" />
          <p className="font-bold">Kailangan munang ma-verify ang account mo para {feature}.</p>
          <p className="mb-3">Kumuha lang ng selfie, at susuriin ito ng Barangay.</p>
          <LinkButton href="/verify" full>{verification?.status === "rejected" ? "Kumuha ulit ng selfie" : "Mag-verify gamit ang selfie"}</LinkButton>
        </div>
      )}
    </LoginGate>
  );
}
