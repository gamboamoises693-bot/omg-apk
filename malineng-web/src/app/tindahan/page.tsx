"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { Plus, Search, Store, ImageOff } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { LISTING_CATEGORIES } from "@/lib/constants";
import { formatPeso, sortNewest, withCustomOptions } from "@/lib/format";
import type { Listing } from "@/lib/types";
import { EmptyState, ErrorText, FilterTabs, LinkButton, Spinner } from "@/components/ui";
import { ContactButtons } from "@/components/ContactButtons";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useVerifiedSet } from "@/lib/useVerifiedSet";
import { isExpired, timeLeft } from "@/lib/listings";

/** Listings are loaded 20 at a time so the page stays light on mobile data. */
const PAGE = 20;

export default function TindahanPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("Lahat");

  const [count, setCount] = useState(PAGE);
  // Newest first needs the (status, createdAt) index from firestore.indexes.json. While that index
  // is still building right after a deploy, fall back to an unordered (but still limited) query.
  const [fallback, setFallback] = useState(false);
  const q = useMemo(
    () =>
      fallback
        ? query(collection(db, "listings"), where("status", "==", "approved"), limit(count))
        : query(collection(db, "listings"), where("status", "==", "approved"), orderBy("createdAt", "desc"), limit(count)),
    [count, fallback],
  );
  const { data, loading, error } = useCollection<Listing>(q);
  useEffect(() => {
    if (error && !fallback) setFallback(true);
  }, [error, fallback]);
  const hasMore = data.length >= count;
  const verified = useVerifiedSet();

  const listings = useMemo(() => {
    const now = Date.now();
    const term = search.trim().toLowerCase();
    return sortNewest(data).filter((l) => {
      const notExpired = !isExpired(l) && now > 0;
      const matchCategory = category === "Lahat" || l.category === category;
      const matchSearch = !term || `${l.title} ${l.description} ${l.sellerName} ${l.purok}`.toLowerCase().includes(term);
      return notExpired && matchCategory && matchSearch;
    });
  }, [data, search, category]);

  return (
    <div>
      <div className="-mx-4 -mt-4 mb-3 bg-gradient-to-br from-brand to-brand-deep px-4 pb-4 pt-4 text-white">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold">Tindahan ng Malineng</h1>
            <p className="text-[0.85rem] text-white/85">Libre mag-benta. Walang bayad, walang commission.</p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Store className="h-6 w-6" aria-hidden />
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hanapin: adobo, halaman, damit..."
            className="w-full rounded-xl border-0 bg-white py-3 pl-10 pr-4 outline-none ring-2 ring-transparent focus:ring-brand"
            aria-label="Hanapin sa Tindahan"
          />
        </div>
      </div>

      {/* Categories: same underline tabs as the rest of the site (scrolls sideways, no scrollbar) */}
      <FilterTabs label="Kategorya ng paninda" value={category} onChange={setCategory} options={["Lahat", ...withCustomOptions(LISTING_CATEGORIES, data.map((l) => l.category))].map((c) => ({ value: c, label: c }))} />

      <LinkButton href="/tindahan/magbenta" variant="primary" full className="mb-4">
        <Plus className="h-5 w-5" /> Magbenta (Libre!)
      </LinkButton>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorText>{error}</ErrorText>
      ) : listings.length === 0 ? (
        <EmptyState icon={<Store className="h-12 w-12" />} title="Walang nakitang paninda">
          Subukan ang ibang category o search.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {listings.map((l) => (
            <div key={l.id} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
              <Link href={`/tindahan/item?id=${l.id}`} className="relative block">
                <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[0.65rem] font-semibold text-white">⏱ {timeLeft(l)}</span>
                {l.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.photoURL} alt={l.title} loading="lazy" className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-surface text-gray-300">
                    <ImageOff className="h-10 w-10" aria-hidden />
                  </div>
                )}
                <div className="p-3 pb-2">
                  <p className="line-clamp-2 font-semibold leading-tight text-gray-800">{l.title}</p>
                  <p className="mt-1 text-base font-extrabold text-brand">{formatPeso(l.price)}</p>
                  <p className="truncate text-sm text-gray-500">{l.sellerName}<VerifiedBadge show={verified.has(l.sellerId)} className="ml-0.5 align-[-2px]" /> · {l.purok}</p>
                </div>
              </Link>
              <div className="mt-auto p-3 pt-0">
                <ContactButtons contact={l.contact} messengerLink={l.messengerLink} size="sm" />
              </div>
            </div>
          ))}
        </div>
      )}
      {hasMore && !loading && (
        <button onClick={() => setCount((c) => c + PAGE)} className="mt-4 w-full rounded-xl bg-white py-3 text-sm font-bold text-brand shadow-card active:bg-brand-light">
          Magpakita pa ng paninda
        </button>
      )}
      <p className="mt-4 text-center text-xs text-gray-400">Tumatagal ng 24 oras ang bawat paninda para laging bago ang Tindahan.</p>
    </div>
  );
}
