"use client";

import { useRef, useState } from "react";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { ImageOff, ImageUp } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { compressToDataUrl } from "@/lib/upload";
import { logActivity, type ActivityType } from "@/lib/activity";
import { friendlyError } from "@/lib/format";
import { useToast } from "@/components/Toast";

/**
 * Super Admin only: replace or remove the picture of any post, listing or lost & found report.
 * `collectionName/id.photoURL` is updated; for listings the full-size copy (`listingPhotos/{id}`) is removed too,
 * so the detail page falls back to the new picture instead of showing the old one.
 */
export function SuperPhotoTools({ collectionName, id, hasPhoto, what, tab }: { collectionName: "posts" | "listings" | "lostFound"; id: string; hasPhoto: boolean; what: string; tab: ActivityType }) {
  const { isSuperAdmin } = useAuth();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (!isSuperAdmin) return null;

  const save = async (photoURL: string) => {
    setBusy(true);
    try {
      await updateDoc(doc(db, collectionName, id), collectionName === "posts" ? { photoURL, photos: [] } : { photoURL });
      if (collectionName === "listings") await deleteDoc(doc(db, "listingPhotos", id)).catch(() => undefined);
      logActivity(tab, `${photoURL ? "Pinalitan" : "Inalis"} ang litrato ng ${what}`, id);
      toast(photoURL ? "Napalitan ang litrato." : "Inalis ang litrato.");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const pick = async (file?: File) => {
    if (!file) return;
    try {
      await save(await compressToDataUrl(file, 900, 0.75, 250_000));
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3 pt-2 text-xs">
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 font-bold text-gray-700 disabled:opacity-50">
        <ImageUp className="h-3.5 w-3.5" aria-hidden /> {hasPhoto ? "Palitan ang litrato" : "Maglagay ng litrato"} (Developer)
      </button>
      {hasPhoto && (
        <button type="button" disabled={busy} onClick={() => confirm("Alisin ang litrato?") && save("")} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 font-bold text-red-700 disabled:opacity-50">
          <ImageOff className="h-3.5 w-3.5" aria-hidden /> Alisin
        </button>
      )}
    </div>
  );
}
