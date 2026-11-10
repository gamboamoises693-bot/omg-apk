"use client";

import { useMemo, useState } from "react";
import { collection, deleteDoc, doc, query, updateDoc, where } from "firebase/firestore";
import { Check, X, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { formatPeso, friendlyError, sortNewest, timeAgo } from "@/lib/format";
import type { Job, Listing, Post } from "@/lib/types";
import { deadlineLabel, urlHost, type Opening } from "@/lib/hiring";
import { Button, Card, EmptyState, SectionTitle, Spinner } from "@/components/ui";
import { PostCard } from "@/components/PostCard";
import { SellerInfo } from "./SellerInfo";
import { deleteListing, isExpired, newExpiry } from "@/lib/listings";
import { useToast } from "@/components/Toast";
import { logActivity } from "@/lib/activity";

function useModerate(collectionName: "listings" | "jobs") {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const setStatus = async (id: string, status: "approved" | "rejected", label = "") => {
    setBusyId(id);
    try {
      // The 24-hour clock of a listing starts when it is approved.
      await updateDoc(doc(db, collectionName, id), collectionName === "listings" && status === "approved" ? { status, expiresAt: newExpiry() } : { status });
      logActivity(collectionName === "listings" ? "Tindahan" : "Trabaho", `${status === "approved" ? "Nag-approve" : "Nag-reject"} ng ${collectionName === "listings" ? "paninda" : "trabaho"}${label ? `: “${label}”` : ""}`, id);
      toast(status === "approved" ? "Na-approve!" : "Na-reject.");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusyId(null);
    }
  };
  return { busyId, setStatus };
}

function ApproveButtons({ busy, onApprove, onReject }: { busy: boolean; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Button onClick={onApprove} loading={busy}><Check className="h-5 w-5" /> Approve</Button>
      <Button variant="danger" onClick={onReject} loading={busy}><X className="h-5 w-5" /> Reject</Button>
    </div>
  );
}

export function AdminModeration() {
  const toast = useToast();
  const postsQ = useMemo(() => query(collection(db, "posts"), where("status", "==", "pending")), []);
  const listingsQ = useMemo(() => query(collection(db, "listings"), where("status", "==", "pending")), []);
  const jobsQ = useMemo(() => query(collection(db, "jobs"), where("status", "==", "pending")), []);
  const openingsQ = useMemo(() => query(collection(db, "openings"), where("status", "==", "pending")), []);
  const approvedListingsQ = useMemo(() => query(collection(db, "listings"), where("status", "==", "approved")), []);

  const posts = useCollection<Post>(postsQ);
  const listings = useCollection<Listing>(listingsQ);
  const jobs = useCollection<Job>(jobsQ);
  const openings = useCollection<Opening>(openingsQ);
  const [openingBusy, setOpeningBusy] = useState<string | null>(null);
  const decideOpening = async (o: Opening, status: "approved" | "rejected") => {
    setOpeningBusy(o.id);
    try {
      await updateDoc(doc(db, "openings", o.id), { status });
      logActivity("Hiring", `${status === "approved" ? "Nag-approve" : "Nag-reject"} ng bakante: “${o.title}”`, o.id);
      toast(status === "approved" ? "Na-approve!" : "Na-reject.");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setOpeningBusy(null);
    }
  };
  const approvedListings = useCollection<Listing>(approvedListingsQ);
  const listingMod = useModerate("listings");
  const jobMod = useModerate("jobs");

  const expired = useMemo(() => approvedListings.data.filter((l) => isExpired(l)), [approvedListings.data]);

  const cleanupExpired = async () => {
    if (!confirm(`Burahin ang ${expired.length} expired na paninda?`)) return;
    try {
      await Promise.all(expired.map((l) => deleteListing(l.id)));
      logActivity("Tindahan", `Nagbura ng ${expired.length} expired na paninda`);
      toast("Nalinis na ang expired listings.");
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  if (posts.loading || listings.loading || jobs.loading || openings.loading) return <Spinner />;

  return (
    <div>
      <SectionTitle>Tindahan ({listings.data.length})</SectionTitle>
      {listings.data.length === 0 ? (
        <EmptyState title="Walang pending na paninda" />
      ) : (
        <div className="space-y-3">
          {sortNewest(listings.data).map((l) => (
            <Card key={l.id}>
              <div className="flex gap-3">
                {l.photoURL && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.photoURL} alt="" className="h-24 w-24 rounded-xl object-cover" />
                )}
                <div className="min-w-0">
                  <p className="font-bold">{l.title}</p>
                  <p className="font-semibold text-brand">{formatPeso(l.price)} · {l.category}</p>
                  <p className="text-sm text-gray-500">{l.purok} · {timeAgo(l.createdAt)}</p>
                </div>
              </div>
              {l.description && <p className="mt-2 whitespace-pre-line text-gray-700">{l.description}</p>}
              <SellerInfo uid={l.sellerId} contact={l.contact} messengerLink={l.messengerLink} kind="listings" />
              <ApproveButtons busy={listingMod.busyId === l.id} onApprove={() => listingMod.setStatus(l.id, "approved", l.title)} onReject={() => listingMod.setStatus(l.id, "rejected", l.title)} />
            </Card>
          ))}
        </div>
      )}
      {expired.length > 0 && (
        <Button variant="outline" full className="mt-3" onClick={cleanupExpired}>
          <Trash2 className="h-5 w-5" /> Burahin ang {expired.length} expired na paninda
        </Button>
      )}

      <SectionTitle>Community Board ({posts.data.length})</SectionTitle>
      {posts.data.length === 0 ? (
        <EmptyState title="Walang pending na post" />
      ) : (
        <div className="space-y-3">{sortNewest(posts.data).map((p) => <PostCard key={p.id} post={p} adminMode />)}</div>
      )}

      <SectionTitle>Hiring: bakante ({openings.data.length})</SectionTitle>
      {openings.data.length === 0 ? (
        <EmptyState title="Walang pending na bakante" />
      ) : (
        <div className="space-y-3">
          {sortNewest(openings.data).map((o) => (
            <Card key={o.id}>
              <p className="font-bold">{o.title} <span className="font-normal text-gray-500">· {o.slots} ang kailangan</span></p>
              <p className="text-gray-600">{o.employer} · {o.type} · {o.salary || "walang sahod na nakalagay"}</p>
              <p className="text-sm text-gray-500">{o.location || o.purok || "—"} · {deadlineLabel(o.deadline)} · {timeAgo(o.createdAt)}</p>
              {o.applyUrl && (
                <p className="mt-1 break-all rounded-lg bg-yellow-50 px-2 py-1 text-xs text-yellow-900">
                  Link: <a href={o.applyUrl} target="_blank" rel="noopener noreferrer nofollow" className="font-bold underline">{urlHost(o.applyUrl)}</a> · tingnan muna bago i-approve ({o.applyUrl})
                </p>
              )}
              {o.requirements.length > 0 && <p className="mt-1 text-sm text-gray-600">Kailangan: {o.requirements.join("; ")}</p>}
              <SellerInfo uid={o.posterId} contact={o.contact} kind="jobs" />
              <ApproveButtons busy={openingBusy === o.id} onApprove={() => decideOpening(o, "approved")} onReject={() => decideOpening(o, "rejected")} />
            </Card>
          ))}
        </div>
      )}

      <SectionTitle>Sideline ({jobs.data.length})</SectionTitle>
      {jobs.data.length === 0 ? (
        <EmptyState title="Walang pending na trabaho" />
      ) : (
        <div className="space-y-3">
          {sortNewest(jobs.data).map((j) => (
            <Card key={j.id}>
              <p className="font-bold">{j.title}</p>
              <p className="text-gray-600">{j.category} · {j.purok} · {j.salary}</p>
              <p className="text-sm text-gray-500">{timeAgo(j.createdAt)}</p>
              <SellerInfo uid={j.posterId} contact={j.contact} kind="jobs" />
              <ApproveButtons busy={jobMod.busyId === j.id} onApprove={() => jobMod.setStatus(j.id, "approved", j.title)} onReject={() => jobMod.setStatus(j.id, "rejected", j.title)} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
