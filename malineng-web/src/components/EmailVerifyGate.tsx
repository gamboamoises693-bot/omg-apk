"use client";

import { useAuth } from "@/context/AuthContext";
import { EmailVerifyBanner } from "./EmailVerifyCard";

/** Client wrapper so the (server) layout can show the "confirm your email" banner. */
export function EmailVerifyGate() {
  const { user, isStaff } = useAuth();
  return <EmailVerifyBanner user={user} isStaff={isStaff} />;
}
