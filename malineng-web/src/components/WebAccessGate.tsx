"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { WEB_FEATURES, levelOf, useWebAccess } from "@/lib/webAccess";
import { isDevRoom, isHelpRoom } from "@/lib/chat";
import { LinkButton, Spinner } from "./ui";
import { LoginGate } from "./LoginGate";
import { RequireVerified } from "./RequireVerified";

/** What residents see when the Super Admin switched a service off. */
export function ComingSoon({ label }: { label: string }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl bg-white p-6 text-center shadow-card">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-500">
        <Lock className="h-7 w-7" aria-hidden />
      </span>
      <p className="text-lg font-extrabold">{label}: Malapit na!</p>
      <p className="text-sm text-gray-600">Inaayos pa ng Barangay ang bahaging ito. Babalikan namin kapag handa na.</p>
      <LinkButton href="/" variant="soft" className="mt-2">Bumalik sa Home</LinkButton>
    </div>
  );
}

/**
 * Applies the Super Admin's Web Access choices to whole pages.
 * Admins and officers always get through. This only hides screens: the data rules
 * in firestore.rules are what actually protect private data.
 */
export function WebAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  // The private help chat and the chat with the Developer only need a login (the person may not be verified yet);
  // the chat page applies that login check itself.
  if (pathname.split("/").filter(Boolean)[0] === "chat") return <Suspense fallback={<Spinner />}><ChatGate>{children}</ChatGate></Suspense>;
  return <Gate pathname={pathname}>{children}</Gate>;
}

/** /chat: the help room and the Developer room skip the "verified" level; every other room follows Web Access. */
function ChatGate({ children }: { children: ReactNode }) {
  const room = useSearchParams().get("room") ?? "";
  const { isStaff, loading } = useAuth();
  if (!loading && !isStaff && (isHelpRoom(room) || isDevRoom(room))) return <>{children}</>;
  return <Gate pathname="/chat">{children}</Gate>;
}

function Gate({ children, pathname }: { children: ReactNode; pathname: string }) {
  const { isStaff, loading: authLoading } = useAuth();
  const { access, loading } = useWebAccess();

  const segment = pathname.split("/").filter(Boolean)[0] ?? "";
  const feature = WEB_FEATURES.find((f) => f.key === segment);
  if (!feature) return <>{children}</>;
  if (loading || authLoading) return <Spinner />;
  if (isStaff) return <>{children}</>;

  switch (levelOf(access, feature.key)) {
    case "off":
      return <ComingSoon label={feature.label} />;
    case "login":
      return <LoginGate message={`Mag-login para magamit ang ${feature.label}.`}>{children}</LoginGate>;
    case "verified":
      return <RequireVerified feature={`magamit ang ${feature.label}`}>{children}</RequireVerified>;
    default:
      return <>{children}</>;
  }
}
