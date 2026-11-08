"use client";

import { useMemo } from "react";
import Link from "next/link";
import { collection, query, where } from "firebase/firestore";
import { ShieldCheck } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";

/** Admin shortcut with a live red badge for new ambulance requests. Renders nothing for non-admins. */
export function AdminShieldLink() {
  const { isAdmin } = useAuth();
  const pendingQ = useMemo(() => (isAdmin ? query(collection(db, "ambulanceRequests"), where("status", "==", "pending")) : null), [isAdmin]);
  const { data: pending } = useCollection<{ id: string }>(pendingQ);
  if (!isAdmin) return null;

  return (
    <Link
      href={pending.length ? "/admin/#ambulansya" : "/admin"}
      className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15 active:bg-white/25"
      aria-label={pending.length ? `Admin, ${pending.length} bagong ambulance request` : "Admin"}
    >
      <ShieldCheck className="h-5 w-5" />
      {pending.length > 0 && (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black ring-2 ring-brand">
          {pending.length}
        </span>
      )}
    </Link>
  );
}
