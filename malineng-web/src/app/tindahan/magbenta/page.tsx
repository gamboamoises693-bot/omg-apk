"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { compressToDataUrl, uploadImage } from "@/lib/upload";
import { LISTING_CATEGORIES } from "@/lib/constants";
import { LISTING_DURATION_HOURS, newExpiry } from "@/lib/listings";
import { friendlyError, safeMessengerLink } from "@/lib/format";
import { Button, Card, ErrorText, Input, PageHeader, Select, Textarea, LinkButton, SelectOther } from "@/components/ui";
import { ImagePicker } from "@/components/ImagePicker";
import { RequireVerified } from "@/components/RequireVerified";
import { logActivity } from "@/lib/activity";

function SellForm() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ title: "", price: "", category: "", description: "", contact: "", messengerLink: "" });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Prefill contact from profile.
  useEffect(() => {
    if (profile?.contact) setForm((f) => (f.contact ? f : { ...f, contact: profile.contact }));
  }, [profile?.contact]);

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError("");

    const price = Number(form.price);
    if (!form.title.trim()) return setError("Ilagay ang pangalan ng paninda.");
    if (!Number.isFinite(price) || price < 0) return setError("Mali ang presyo.");
    if (!form.category) return setError("Pumili ng category.");
    if (!form.contact.trim()) return setError("Ilagay ang contact number.");
    if (form.messengerLink.trim() && !safeMessengerLink(form.messengerLink)) {
      return setError("Ang Messenger link ay dapat galing sa m.me o facebook.com. Hal: m.me/juandelacruz");
    }

    setLoading(true);
    try {
      // Small thumbnail on the listing (loaded in the grid); full photo in listingPhotos (detail page only).
      const thumb = file ? await compressToDataUrl(file, 360, 0.6, 80_000) : "";
      const full = file ? await uploadImage(file, user.uid) : "";
      const ref = doc(collection(db, "listings"));
      const batch = writeBatch(db);
      batch.set(ref, {
        sellerId: user.uid,
        sellerName: profile?.fullName ?? user.displayName ?? "Residente",
        title: form.title.trim().slice(0, 120),
        price,
        category: form.category,
        description: form.description.trim().slice(0, 2000),
        photoURL: thumb,
        contact: form.contact.trim(),
        messengerLink: form.messengerLink.trim(),
        purok: profile?.purok ?? "",
        status: "pending",
        expiresAt: newExpiry(), // reset again when the admin approves
        createdAt: serverTimestamp(),
      });
      if (full) batch.set(doc(db, "listingPhotos", ref.id), { sellerId: user.uid, photo: full, createdAt: serverTimestamp() });
      await batch.commit();
      logActivity("Tindahan", `Nag-post ng paninda: “${form.title.trim()}” ₱${price}`);
      setDone(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Card className="text-center">
        <CheckCircle2 className="mx-auto mb-2 h-16 w-16 text-brand" />
        <p className="text-lg font-bold">Naipadala na ang paninda mo!</p>
        <p className="mt-1 text-gray-600">Ire-review ito ng admin. Lalabas sa Tindahan kapag na-approve, at tatagal ito ng {LISTING_DURATION_HOURS} oras. Pwede mo itong i-post ulit sa Account pagkatapos.</p>
        <div className="mt-4 grid gap-2">
          <Button full onClick={() => { setDone(false); setFile(null); setForm((f) => ({ ...f, title: "", price: "", description: "" })); }}>Magbenta pa ng iba</Button>
          <LinkButton href="/account" variant="outline" full>Tingnan ang mga paninda ko</LinkButton>
          <Button variant="ghost" full onClick={() => router.push("/tindahan")}>Bumalik sa Tindahan</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <ImagePicker file={file} onChange={setFile} label="Larawan ng paninda" />
        <Input label="Pangalan ng Paninda" required maxLength={120} placeholder="Hal. Lutong Adobo (1 order)" value={form.title} onChange={update("title")} />
        <Input label="Presyo (₱)" type="number" inputMode="decimal" min={0} step="0.01" required placeholder="100" value={form.price} onChange={update("price")} />
        <SelectOther label="Category" required options={LISTING_CATEGORIES} placeholder="-- Pumili --" value={form.category} onChange={(v) => update("category")({ target: { value: v } })} />
        <Textarea label="Description" placeholder="Ilarawan ang paninda, kailan available, delivery o pick-up..." maxLength={2000} value={form.description} onChange={update("description")} />
        <Input label="Contact Number" type="tel" inputMode="tel" required value={form.contact} onChange={update("contact")} />
        <Input label="Messenger Link (optional)" placeholder="m.me/pangalan-mo" hint="Buksan ang Messenger > Profile > kopyahin ang link" value={form.messengerLink} onChange={update("messengerLink")} />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" full loading={loading}>I-post ang Paninda</Button>
        <p className="text-center text-sm text-gray-500">100% Libre. Walang bayad, walang commission.</p>
      </form>
    </Card>
  );
}

export default function MagbentaPage() {
  return (
    <div>
      <Link href="/tindahan" className="mb-3 inline-flex items-center gap-1 font-semibold text-brand">
        <ArrowLeft className="h-5 w-5" /> Tindahan
      </Link>
      <PageHeader title="Magbenta" subtitle="Ilagay ang paninda mo sa Tindahan ng Malineng" />
      <RequireVerified feature="makapagbenta">
        <SellForm />
      </RequireVerified>
    </div>
  );
}
