"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ImageOff, MapPin, Phone, Plus, Search, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { uploadImage } from "@/lib/upload";
import { friendlyError, sortNewest, telHref, timeAgo } from "@/lib/format";
import type { LostFoundItem } from "@/lib/types";
import { Badge, Button, EmptyState, ErrorText, Input, Modal, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { ImagePicker } from "@/components/ImagePicker";
import { LoginGate } from "@/components/LoginGate";
import { useToast } from "@/components/Toast";

type Tab = "nawawala" | "nakita";
const lostFoundCollection = collection(db, "lostFound");

function ReportForm({ defaultType, onDone }: { defaultType: Tab; onDone: () => void }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ type: defaultType as string, item: "", location: "", description: "", contact: "" });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile?.contact) setForm((f) => (f.contact ? f : { ...f, contact: profile.contact }));
  }, [profile?.contact]);

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.item.trim() || !form.location.trim() || !form.contact.trim()) return setError("Kumpletuhin ang item, lugar at contact.");
    setLoading(true);
    setError("");
    try {
      const photoURL = file ? await uploadImage(file, user.uid) : "";
      await addDoc(lostFoundCollection, {
        userId: user.uid,
        type: form.type === "nakita" ? "nakita" : "nawawala",
        item: form.item.trim().slice(0, 120),
        location: form.location.trim().slice(0, 200),
        description: form.description.trim().slice(0, 1500),
        photoURL,
        contact: form.contact.trim(),
        status: "open",
        createdAt: serverTimestamp(),
      });
      toast("Na-report na! Sana mahanap agad.");
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select label="Uri ng report" options={["nawawala", "nakita"]} value={form.type} onChange={update("type")} />
      <Input label="Anong gamit?" required placeholder="Hal. Wallet na itim, aso na kulay brown" value={form.item} onChange={update("item")} />
      <Input label={form.type === "nakita" ? "Saan nakita?" : "Saan nawala?"} required placeholder="Hal. Malapit sa covered court" value={form.location} onChange={update("location")} />
      <Textarea label="Detalye" placeholder="Kulay, laman, oras, atbp." value={form.description} onChange={update("description")} />
      <ImagePicker file={file} onChange={setFile} />
      <Input label="Contact Number" type="tel" required value={form.contact} onChange={update("contact")} />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" full loading={loading}>I-report</Button>
    </form>
  );
}

export default function LostFoundPage() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("nawawala");
  const [open, setOpen] = useState(false);
  const { data, loading, error } = useCollection<LostFoundItem>(lostFoundCollection);

  const items = useMemo(() => sortNewest(data.filter((i) => i.type === tab)), [data, tab]);

  const markReturned = async (id: string) => {
    try {
      await updateDoc(doc(db, "lostFound", id), { status: "nakabalik" });
      toast("Salamat! Na-mark na bilang nakabalik.");
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <div>
      <PageHeader title="Lost & Found" subtitle="Tulungan nating maibalik ang mga nawawala" />

      <div className="mb-4 grid grid-cols-2 rounded-2xl bg-white p-1 ring-1 ring-gray-200" role="tablist">
        {(["nawawala", "nakita"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-xl py-3 font-bold capitalize ${tab === t ? "bg-brand text-white" : "text-gray-600"}`}
          >
            {t === "nawawala" ? "Nawawala" : "Nakita"}
          </button>
        ))}
      </div>

      <Button full variant="gold" className="mb-4" onClick={() => setOpen(true)}><Plus className="h-5 w-5" /> Mag-report</Button>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorText>{error}</ErrorText>
      ) : items.length === 0 ? (
        <EmptyState icon={<Search className="h-12 w-12" />} title={tab === "nawawala" ? "Walang naka-report na nawawala" : "Walang naka-report na nakita"} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((i) => (
            <div key={i.id} className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 ${i.status === "nakabalik" ? "opacity-70" : ""}`}>
              {i.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.photoURL} alt={i.item} loading="lazy" className="h-48 w-full object-cover" />
              ) : (
                <div className="flex h-32 items-center justify-center bg-surface text-gray-300"><ImageOff className="h-10 w-10" /></div>
              )}
              <div className="p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-base font-bold">{i.item}</p>
                  {i.status === "nakabalik" ? <Badge color="green">Nakabalik na</Badge> : <Badge color={i.type === "nawawala" ? "red" : "blue"}>{i.type === "nawawala" ? "Nawawala" : "Nakita"}</Badge>}
                </div>
                <p className="flex items-center gap-1 text-gray-600"><MapPin className="h-4 w-4" /> {i.location}</p>
                {i.description && <p className="mt-1 whitespace-pre-line text-gray-700">{i.description}</p>}
                <p className="mt-1 text-sm text-gray-400">{timeAgo(i.createdAt)}</p>
                <a href={telHref(i.contact)} className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-white">
                  <Phone className="h-5 w-5" /> {i.contact}
                </a>
                {user && i.status === "open" && (isAdmin || i.userId === user.uid) && (
                  <Button variant="outline" full className="mt-2" onClick={() => markReturned(i.id)}>
                    <CheckCircle2 className="h-5 w-5" /> Nakabalik na
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Mag-report">
        <LoginGate message="Mag-login para makapag-report.">
          <ReportForm defaultType={tab} onDone={() => setOpen(false)} />
        </LoginGate>
      </Modal>
    </div>
  );
}
