"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, ImageOff, MapPin, Tag, UserRound, CalendarClock } from "lucide-react";
import { db } from "@/lib/firebase";
import { formatDate, formatPeso, timeAgo } from "@/lib/format";
import type { Listing } from "@/lib/types";
import { Badge, Card, EmptyState, Spinner } from "@/components/ui";
import { ContactButtons } from "@/components/ContactButtons";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useVerifiedSet } from "@/lib/useVerifiedSet";

/**
 * Listing detail. Uses ?id= query param (instead of /tindahan/[id])
 * because static export cannot pre-render user-created IDs.
 */
function ListingDetail() {
  const params = useSearchParams();
  const id = params.get("id");
  const [listing, setListing] = useState<Listing | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [fullPhoto, setFullPhoto] = useState<string | null>(null);
  const verified = useVerifiedSet();

  useEffect(() => {
    if (!id) {
      setState("missing");
      return;
    }
    getDoc(doc(db, "listings", id))
      .then((snap) => {
        if (!snap.exists()) return setState("missing");
        setListing({ id: snap.id, ...snap.data() } as Listing);
        setState("ok");
        // Full-size photo lives in its own document (the listing only has a thumbnail).
        getDoc(doc(db, "listingPhotos", snap.id))
          .then((p) => p.exists() && setFullPhoto(p.data().photo as string))
          .catch(() => undefined);
      })
      .catch(() => setState("missing")); // permission-denied = not approved / not owner
  }, [id]);

  if (state === "loading") return <Spinner />;
  if (state === "missing" || !listing) {
    return (
      <EmptyState icon={<ImageOff className="h-12 w-12" />} title="Hindi mahanap ang paninda">
        <Link href="/tindahan" className="font-bold text-brand underline">Bumalik sa Tindahan</Link>
      </EmptyState>
    );
  }

  const expired = listing.expiresAt && listing.expiresAt.toMillis() < Date.now();

  return (
    <div>
      <Link href="/tindahan" className="mb-3 inline-flex items-center gap-1 font-semibold text-brand">
        <ArrowLeft className="h-5 w-5" /> Bumalik sa Tindahan
      </Link>

      {fullPhoto || listing.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fullPhoto ?? listing.photoURL} alt={listing.title} className="-mx-4 w-[calc(100%+2rem)] max-w-none bg-black object-contain sm:mx-0 sm:w-full sm:rounded-2xl" style={{ maxHeight: "70vh" }} />
      ) : (
        <div className="flex h-64 items-center justify-center rounded-2xl bg-white text-gray-300">
          <ImageOff className="h-16 w-16" aria-hidden />
        </div>
      )}

      <Card className="mt-4">
        <div className="mb-2 flex flex-wrap gap-2">
          <Badge color="gold"><Tag className="mr-1 inline h-4 w-4" />{listing.category}</Badge>
          {listing.status !== "approved" && <Badge color="gray">Naghihintay ng approval</Badge>}
          {expired && <Badge color="red">Expired na</Badge>}
        </div>
        <h1 className="text-lg font-bold">{listing.title}</h1>
        <p className="mt-1 text-2xl font-extrabold text-brand">{formatPeso(listing.price)}</p>
        <p className="mt-4 whitespace-pre-line text-gray-700">{listing.description || "Walang description."}</p>
        <div className="mt-4 space-y-1 text-gray-600">
          <p className="flex items-center gap-2"><UserRound className="h-5 w-5" /> {listing.sellerName}<VerifiedBadge show={verified.has(listing.sellerId)} />{verified.has(listing.sellerId) && <span className="text-xs font-semibold text-blue-600">Verified</span>}</p>
          <p className="flex items-center gap-2"><MapPin className="h-5 w-5" /> {listing.purok}, Malineng</p>
          <p className="flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Na-post {timeAgo(listing.createdAt)}
            {listing.expiresAt && ` · Hanggang ${formatDate(listing.expiresAt.toDate())}`}
          </p>
        </div>
      </Card>

      <Card className="mt-4">
        <p className="mb-2 font-bold">Kontakin ang Seller</p>
        <p className="mb-3 text-base">{listing.contact}</p>
        <ContactButtons contact={listing.contact} messengerLink={listing.messengerLink} />
        <p className="mt-3 text-sm text-gray-500">Paalala: Makipagkita sa ligtas na lugar. Huwag magbayad nang buo bago makita ang item.</p>
      </Card>
    </div>
  );
}

export default function ListingItemPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ListingDetail />
    </Suspense>
  );
}
