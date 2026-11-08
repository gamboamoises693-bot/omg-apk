"use client";

import type { ReactNode } from "react";
import { LogIn } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LinkButton, Spinner } from "./ui";

/**
 * Renders children only when logged in.
 * Guests see a friendly prompt instead (view-only mode).
 */
export function LoginGate({ children, message = "Mag-login muna para magamit ito." }: { children: ReactNode; message?: string }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) {
    return (
      <div className="rounded-2xl bg-gold-light p-5 text-center">
        <LogIn className="mx-auto mb-2 h-8 w-8 text-brand" aria-hidden />
        <p className="mb-3 font-semibold text-gray-800">{message}</p>
        <div className="flex gap-2">
          <LinkButton href="/login" full>Mag-login</LinkButton>
          <LinkButton href="/register" variant="outline" full>Mag-register</LinkButton>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export function AdminGate({ children }: { children: ReactNode }) {
  const { isAdmin, loading, user } = useAuth();
  if (loading) return <Spinner />;
  if (!user || !isAdmin) {
    return <p className="rounded-2xl bg-red-50 p-5 text-center font-semibold text-red-700">Para sa Barangay Admin lang ang page na ito.</p>;
  }
  return <>{children}</>;
}
