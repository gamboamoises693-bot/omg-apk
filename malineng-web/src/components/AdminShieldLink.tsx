"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAdminPending, PENDING_TAB } from "@/context/AdminPendingContext";

/** Admin shortcut with a live red badge: total items waiting for approval. Hidden for non-admins. */
export function AdminShieldLink() {
  const { isAdmin } = useAuth();
  const { total, items } = useAdminPending();
  if (!isAdmin) return null;

  // Jump to the most urgent tab: emergencies first, otherwise the first waiting item.
  const first = items.find((i) => i.emergency) ?? items[0];
  const href = first ? `/admin/#${PENDING_TAB[first.kind]}` : "/admin";

  return (
    <Link
      href={href}
      className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15 active:bg-white/25"
      aria-label={total ? `Admin, ${total} naghihintay ng approval` : "Admin"}
    >
      <ShieldCheck className="h-5 w-5" />
      {total > 0 && (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black ring-2 ring-brand">
          {total > 99 ? "99+" : total}
        </span>
      )}
    </Link>
  );
}
