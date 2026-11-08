"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { BadgeCheck, MessageCircle, Phone, ShieldAlert, UserRound } from "lucide-react";
import { db } from "@/lib/firebase";
import { ageFrom } from "@/lib/age";
import { roleLabel } from "@/lib/activity";
import { formatDate, safeMessengerLink, telHref, timeAgo } from "@/lib/format";
import type { UserProfile, Verification } from "@/lib/types";

interface Info {
  user: UserProfile | null;
  verification: Verification | null;
  history: { approved: number; rejected: number; total: number };
}

/**
 * Who posted this? Shown to admins when approving a listing or job:
 * profile, selfie verification, contact and past posts.
 */
export function SellerInfo({ uid, contact, messengerLink, kind }: { uid: string; contact?: string; messengerLink?: string; kind: "listings" | "jobs" }) {
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    let alive = true;
    const ownerField = kind === "listings" ? "sellerId" : "posterId";
    Promise.all([
      getDoc(doc(db, "users", uid)).catch(() => null),
      getDoc(doc(db, "verifications", uid)).catch(() => null),
      getDocs(query(collection(db, kind), where(ownerField, "==", uid))).catch(() => null),
    ]).then(([u, v, past]) => {
      if (!alive) return;
      const docs = past?.docs.map((d) => d.data()) ?? [];
      setInfo({
        user: u?.exists() ? ({ uid, ...u.data() } as UserProfile) : null,
        verification: v?.exists() ? ({ id: v.id, ...v.data() } as Verification) : null,
        history: {
          approved: docs.filter((d) => d.status === "approved").length,
          rejected: docs.filter((d) => d.status === "rejected").length,
          total: docs.length,
        },
      });
    });
    return () => {
      alive = false;
    };
  }, [uid, kind]);

  if (!info) return <div className="mt-3 h-20 animate-pulse rounded-xl bg-gray-100" />;

  const { user, verification, history } = info;
  const verified = verification?.status === "verified";
  const age = user ? ageFrom(user.birthday) : null;
  const messenger = messengerLink ? safeMessengerLink(messengerLink) : null;
  const phone = contact || user?.contact || "";

  return (
    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Impormasyon ng {kind === "listings" ? "seller" : "nag-post"}</p>
      {!user ? (
        <p className="flex items-center gap-1 font-semibold text-red-700"><ShieldAlert className="h-4 w-4" /> Wala nang account ang user na ito.</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            {verification?.selfie ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={verification.selfie} alt="Selfie" className="h-14 w-14 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500"><UserRound className="h-6 w-6" /></span>
            )}
            <div className="min-w-0">
              <p className="truncate font-bold">{user.fullName}</p>
              <p className="text-xs text-gray-500">{roleLabel(user.role, user.position)}{user.suspended ? " · SUSPENDED" : ""}</p>
              {verified ? (
                <p className="flex items-center gap-1 text-xs font-bold text-blue-600"><BadgeCheck className="h-3.5 w-3.5" /> Verified{verification?.reviewedByName ? ` ni ${verification.reviewedByName}` : ""}</p>
              ) : (
                <p className="text-xs font-bold text-yellow-700">⚠ Hindi pa verified{verification ? ` (${verification.status === "pending" ? "naghihintay" : "na-reject"})` : ""}</p>
              )}
            </div>
          </div>
          <dl className="mt-2 grid grid-cols-[88px_1fr] gap-x-2 gap-y-0.5 text-xs">
            <dt className="text-gray-500">Purok</dt><dd className="font-semibold">{user.purok || "—"}</dd>
            <dt className="text-gray-500">Edad</dt><dd className="font-semibold">{age !== null ? `${age} (${formatDate(user.birthday)})` : "—"}</dd>
            <dt className="text-gray-500">Email</dt><dd className="break-all font-semibold">{user.email || "—"}</dd>
            <dt className="text-gray-500">Miyembro</dt><dd className="font-semibold">{timeAgo(user.createdAt)}</dd>
            <dt className="text-gray-500">Dating post</dt>
            <dd className="font-semibold">{history.total} lahat · {history.approved} approved · <span className={history.rejected ? "text-red-600" : ""}>{history.rejected} rejected</span></dd>
          </dl>
        </>
      )}
      <div className={`mt-2 grid gap-2 ${messenger ? "grid-cols-2" : "grid-cols-1"}`}>
        {phone && (
          <a href={telHref(phone)} className="flex items-center justify-center gap-1 rounded-lg bg-brand py-2 text-xs font-bold text-white">
            <Phone className="h-3.5 w-3.5" /> {phone}
          </a>
        )}
        {messenger && (
          <a href={messenger} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 rounded-lg bg-[#0084FF] py-2 text-xs font-bold text-white">
            <MessageCircle className="h-3.5 w-3.5" /> Messenger
          </a>
        )}
      </div>
    </div>
  );
}
