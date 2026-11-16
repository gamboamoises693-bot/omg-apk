"use client";

import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { helpRoomOf } from "@/lib/chat";

/** "Nahihirapan sa pag-setup?" card: opens the private help chat with the Barangay admins and the Developer. Not shown to admins. */
export function HelpSetupLink({ className = "" }: { className?: string }) {
  const { user, isStaff } = useAuth();
  if (!user || isStaff) return null;
  return (
    <Link href={`/chat/?room=${encodeURIComponent(helpRoomOf(user.uid))}`} className={`flex items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-card active:bg-gray-50 ${className}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white"><LifeBuoy className="h-5 w-5" aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">Nahihirapan sa pag-setup?</span>
        <span className="block text-xs text-gray-500">Makipag-chat sa mga admin ng Barangay at sa Developer. Pribado ito.</span>
      </span>
    </Link>
  );
}
