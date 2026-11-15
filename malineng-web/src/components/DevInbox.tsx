"use client";

import { useMemo } from "react";
import Link from "next/link";
import { collection, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { devRoomOf, getLastRead, timeLabel, type DevChat } from "@/lib/chat";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/ui";

const isFresh = (c: DevChat): boolean => c.lastFrom === "user" && !!c.lastAt && c.lastAt.toMillis() > getLastRead(devRoomOf(c.uid));

/** One person's line in the Developer's inbox. */
function DevInboxRow({ c }: { c: DevChat }) {
  return (
    <Link href={`/chat/?room=${encodeURIComponent(devRoomOf(c.uid))}`} className="flex items-center gap-3 border-b border-gray-100 px-3 py-3 last:border-0 active:bg-gray-50">
      <Avatar name={c.name || "?"} size="h-11 w-11" textClass="text-base" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{c.name || "Residente"}</span>
        <span className="block truncate text-xs text-gray-500">{c.lastFrom === "dev" ? "Ikaw: " : ""}{c.lastText}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[0.68rem] text-gray-500">{timeLabel(c.lastAt)}</span>
        {isFresh(c) && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[0.65rem] font-black text-white">Bago</span>}
      </span>
    </Link>
  );
}

/** Everyone who wrote to the Developer, newest first. Used in Chat and in the Admin menu. */
export function DevInbox({ heading = false }: { heading?: boolean }) {
  const q = useMemo(() => query(collection(db, "devChats"), orderBy("lastAt", "desc"), limit(50)), []);
  const { data, loading } = useCollection<DevChat>(q);
  const waiting = data.filter(isFresh).length;
  return (
    <div className="space-y-2">
      {heading && <p className="px-1 text-xs font-bold tracking-wide text-purple-700">MGA MENSAHE SA DEVELOPER{waiting ? ` · ${waiting} BAGO` : ""}</p>}
      {!heading && (
        <p className="rounded-xl bg-purple-50 px-3 py-2 text-sm text-purple-900">
          Dito makikita kung sinong residente o negosyo ang sumulat sa iyo. Pindutin ang pangalan para sumagot. {waiting ? <b>{waiting} ang hindi mo pa nababasa.</b> : "Wala kang hindi nababasa."}
        </p>
      )}
      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        {loading ? <Spinner /> : data.length === 0 ? <p className="p-4 text-center text-sm text-gray-600">Wala pang sumulat sa iyo.</p> : data.map((c) => <DevInboxRow key={c.id} c={c} />)}
      </div>
    </div>
  );
}

/** Number of people waiting for an answer (for the Admin menu badge). Only the Developer can read the inbox. */
export function useDevInboxCount(enabled: boolean): number {
  const q = useMemo(() => (enabled ? query(collection(db, "devChats"), orderBy("lastAt", "desc"), limit(30)) : null), [enabled]);
  const { data } = useCollection<DevChat>(q);
  return data.filter(isFresh).length;
}
