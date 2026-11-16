"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { helpRoomOf } from "@/lib/chat";

/**
 * For admins: opens a private chat with this person (the same room as their "Nahihirapan sa pag-setup?" chat).
 * The person is told in the app (badge and notification) when they open it. Not shown for yourself.
 */
export function ChatWithButton({ uid, name, compact = false, className = "" }: { uid: string; name: string; compact?: boolean; className?: string }) {
  const { user, isAdmin } = useAuth();
  if (!isAdmin || !user || user.uid === uid) return null;
  const href = `/chat/?room=${encodeURIComponent(helpRoomOf(uid))}`;
  if (compact) {
    return (
      <Link href={href} aria-label={`Mag-chat kay ${name}`} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand active:opacity-70 ${className}`}>
        <MessageCircle className="h-4 w-4" aria-hidden />
      </Link>
    );
  }
  return (
    <Link href={href} className={`flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-bold text-white active:opacity-80 ${className}`}>
      <MessageCircle className="h-4 w-4" aria-hidden /> Mag-chat kay {name.split(/\s+/)[0]}
    </Link>
  );
}
