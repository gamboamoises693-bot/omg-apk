"use client";

import { useMemo, useState } from "react";
import { collection, deleteDoc, doc, query, updateDoc, where } from "firebase/firestore";
import { Check, X, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { formatPeso, friendlyError, sortNewest, timeAgo } from "@/lib/format";
import type { Job, Listing, Post } from "@/lib/types";
import { Button, Card, EmptyState, SectionTitle, Spinner } from "@/components/ui";
import { PostCard } from "@/components/PostCard";
import { SellerInfo } from "./SellerInfo";
import { useToast } from "@/components/Toast";
import { logActivity } from "@/lib/activity";

function useModerate(collectionName: "listings" | "jobs") {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const setStatus = async (id: string, status: "approved" | "rejected", label = "") => {
    setBusyId(id);
    try {
      await updateDoc(doc(db, collectionName, id), { status });
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
  const approvedListingsQ = useMemo(() => query(collection(db, "listings"), where("status", "==", "approved")), []);

  const posts = useCollection<Post>(postsQ);
  const listings = useCollection<Listing>(listingsQ);
  const jobs = useCollection<Job>(jobsQ);
  const approvedListings = useCollection<Listing>(approvedListingsQ);
  const listingMod = useModerate("listings");
  const jobMod = useModerate("jobs");

  const expired = useMemo(() => approvedListings.data.filter((l) => l.expiresAt && l.expiresAt.toMillis() < Date.now()), [approvedListings.data]);

  const cleanupExpired = async () => {
    if (!confirm(`Burahin ang ${expired.length} expired na paninda?`)) return;
    try {
      await Promise.all(expired.map((l) => deleteDoc(doc(db, "listings", l.id))));
      logActivity("Tindahan", `Nagbura ng ${expired.length} expired na paninda`);
      toast("Nalinis na ang expired listings.");
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  if (posts.loading || listings.loading || jobs.loading) return <Spinner />;

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

      <SectionTitle>Trabaho ({jobs.data.length})</SectionTitle>
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
