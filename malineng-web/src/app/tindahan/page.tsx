"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { collection, query, where } from "firebase/firestore";
import { Plus, Search, Store, ImageOff } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { LISTING_CATEGORIES } from "@/lib/constants";
import { formatPeso, sortNewest } from "@/lib/format";
import type { Listing } from "@/lib/types";
import { EmptyState, ErrorText, LinkButton, Spinner } from "@/components/ui";
import { ContactButtons } from "@/components/ContactButtons";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useVerifiedSet } from "@/lib/useVerifiedSet";

export default function TindahanPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("Lahat");

  const q = useMemo(() => query(collection(db, "listings"), where("status", "==", "approved")), []);
  const { data, loading, error } = useCollection<Listing>(q);
  const verified = useVerifiedSet();

  const listings = useMemo(() => {
    const now = Date.now();
    const term = search.trim().toLowerCase();
    return sortNewest(data).filter((l) => {
      const notExpired = !l.expiresAt || l.expiresAt.toMillis() > now;
      const matchCategory = category === "Lahat" || l.category === category;
      const matchSearch = !term || `${l.title} ${l.description} ${l.sellerName} ${l.purok}`.toLowerCase().includes(term);
      return notExpired && matchCategory && matchSearch;
    });
  }, [data, search, category]);

  return (
    <div>
      <div className="-mx-4 -mt-4 mb-4 bg-gold px-4 pb-4 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-brand-dark">Tindahan ng Malineng</h1>
            <p className="text-sm font-semibold text-brand-dark/80">Libre mag-benta. Walang bayad, walang commission.</p>
          </div>
          <Store className="h-10 w-10 text-brand-dark" aria-hidden />
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

      {/* Category chips */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {["Lahat", ...LISTING_CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full px-4 py-2 font-semibold ${category === c ? "bg-brand text-white" : "bg-white text-gray-700 ring-1 ring-gray-200"}`}
            aria-pressed={category === c}
          >
            {c}
          </button>
        ))}
      </div>

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
              <Link href={`/tindahan/item?id=${l.id}`} className="block">
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
    </div>
  );
}
