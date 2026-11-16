"use client";

import { useMemo } from "react";
import Link from "next/link";
import { collection, limit, orderBy, query } from "firebase/firestore";
import { LifeBuoy } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { helpRoomOf, timeLabel, type HelpChat } from "@/lib/chat";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/ui";

/** Admin tab: people asking for help with setting up their account. Whoever is free answers; "Naghihintay" means nobody did yet. */
export function AdminHelpInbox() {
  const q = useMemo(() => query(collection(db, "helpChats"), orderBy("lastAt", "desc"), limit(50)), []);
  const { data, loading } = useCollection<HelpChat>(q);
  const waiting = data.filter((c) => c.lastFrom === "user").length;
  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 rounded-xl bg-brand-light px-3 py-2 text-sm text-brand-deep">
        <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>Mga residenteng nahihirapan sa pag-register, pag-login, selfie o profile. Pindutin ang pangalan para sumagot. {waiting ? <b>{waiting} ang naghihintay ng sagot.</b> : "Walang naghihintay."}</span>
      </p>
      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        {loading ? (
          <Spinner />
        ) : data.length === 0 ? (
          <p className="p-4 text-center text-sm text-gray-600">Wala pang humihingi ng tulong.</p>
        ) : (
          data.map((c) => (
            <Link key={c.id} href={`/chat/?room=${encodeURIComponent(helpRoomOf(c.uid))}`} className="flex items-center gap-3 border-b border-gray-100 px-3 py-3 last:border-0 active:bg-gray-50">
              <Avatar name={c.name || "?"} size="h-11 w-11" textClass="text-base" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{c.name || "Residente"}</span>
                <span className="block truncate text-xs text-gray-500">{c.lastFrom === "staff" ? "Sinagot: " : ""}{c.lastText}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[0.68rem] text-gray-500">{timeLabel(c.lastAt)}</span>
                {c.lastFrom === "user" && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[0.65rem] font-black text-white">Naghihintay</span>}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
