"use client";

import { useMemo, useState, type FormEvent } from "react";
import { addDoc, collection, query, serverTimestamp, where } from "firebase/firestore";
import { ImagePlus, MessagesSquare, PenSquare } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { uploadImage } from "@/lib/upload";
import { friendlyError, sortNewest } from "@/lib/format";
import type { Post } from "@/lib/types";
import { Button, EmptyState, ErrorText, FilterTabs, Modal, PageHeader, SectionTitle, Spinner, Textarea } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { EmojiBar } from "@/components/PostCard";
import { ImagePicker } from "@/components/ImagePicker";
import { LoginGate } from "@/components/LoginGate";
import { PostCard } from "@/components/PostCard";
import { useToast } from "@/components/Toast";
import { logActivity } from "@/lib/activity";

/** Facebook-style composer: a prompt card that opens the writing sheet. */
function Composer() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const first = profile?.fullName?.split(" ")[0] ?? "kabarangay";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!content.trim()) return setError("Sumulat muna ng mensahe.");
    setError("");
    setLoading(true);
    try {
      const photoURL = file ? await uploadImage(file, user.uid) : "";
      await addDoc(collection(db, "posts"), {
        authorId: user.uid,
        authorName: profile?.fullName ?? user.displayName ?? "Residente",
        purok: profile?.purok ?? "",
        content: content.trim().slice(0, 3000),
        photoURL,
        status: "pending",
        likes: [],
        createdAt: serverTimestamp(),
      });
      logActivity("Board", `Nag-post sa Community Board: “${content.trim().slice(0, 60)}”`);
      setContent("");
      setFile(null);
      setOpen(false);
      toast("Naipadala! Lalabas ang post kapag na-approve ng admin.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl bg-white p-3 shadow-card ring-1 ring-gray-100">
        <div className="flex items-center gap-3">
          <Avatar name={profile?.fullName ?? "Ako"} photo={profile?.photoURL} size="h-11 w-11" textClass="text-base" />
          <button type="button" onClick={() => setOpen(true)} className="flex-1 rounded-full bg-gray-100 px-4 py-2.5 text-left text-[0.95rem] text-gray-500 active:bg-gray-200">
            Ano ang nasa isip mo, {first}?
          </button>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-gray-100 pt-2.5">
          <button type="button" onClick={() => setOpen(true)} className="flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold text-emerald-700 active:bg-gray-100">
            <ImagePlus className="h-5 w-5" aria-hidden /> Larawan
          </button>
          <button type="button" onClick={() => setOpen(true)} className="flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold text-brand active:bg-gray-100">
            <PenSquare className="h-5 w-5" aria-hidden /> Mag-post
          </button>
        </div>
      </div>

      <Modal open={open} onClose={() => !loading && setOpen(false)} title="Gumawa ng post">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar name={profile?.fullName ?? "Ako"} photo={profile?.photoURL} size="h-10 w-10" />
            <div className="leading-tight">
              <p className="font-bold">{profile?.fullName}</p>
              <p className="text-xs text-gray-500">{profile?.purok || "Barangay Malineng"}</p>
            </div>
          </div>
          <Textarea label="" placeholder={`Ano ang gusto mong ibahagi, ${first}?`} value={content} onChange={(e) => setContent(e.target.value)} maxLength={3000} autoFocus aria-label="Mensahe ng post" />
          <EmojiBar onPick={(e) => setContent((t) => (t + e).slice(0, 3000))} />
          <ImagePicker file={file} onChange={setFile} />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" full loading={loading}>
            <PenSquare className="h-5 w-5" /> I-post
          </Button>
          <p className="text-center text-sm text-gray-500">Ire-review muna ng admin bago lumabas.</p>
        </form>
      </Modal>
    </>
  );
}

type Tab = "lahat" | "purok" | "akin";

export default function BoardPage() {
  const { user, profile, isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("lahat");
  const approvedQ = useMemo(() => query(collection(db, "posts"), where("status", "==", "approved")), []);
  const pendingQ = useMemo(() => (isAdmin ? query(collection(db, "posts"), where("status", "==", "pending")) : null), [isAdmin]);
  const mineQ = useMemo(() => (user && !isAdmin ? query(collection(db, "posts"), where("authorId", "==", user.uid)) : null), [user, isAdmin]);

  const approved = useCollection<Post>(approvedQ);
  const pending = useCollection<Post>(pendingQ);
  const mine = useCollection<Post>(mineQ);

  const feed = useMemo(() => {
    const all = sortNewest(approved.data);
    if (tab === "purok") return all.filter((p) => !!profile?.purok && p.purok === profile.purok);
    if (tab === "akin") return all.filter((p) => !!user && p.authorId === user.uid);
    return all;
  }, [approved.data, tab, profile?.purok, user]);
  const myWaiting = useMemo(() => sortNewest(mine.data.filter((p) => p.status !== "approved")), [mine.data]);

  return (
    <div>
      <PageHeader title="Community Board" subtitle="Balita at usapan ng mga taga-Malineng" />

      <LoginGate message="Mag-login para makapag-post sa Community Board.">
        <Composer />
      </LoginGate>

      {isAdmin && pending.data.length > 0 && (
        <>
          <SectionTitle>Para i-approve ({pending.data.length})</SectionTitle>
          <div className="space-y-3">
            {sortNewest(pending.data).map((p) => (
              <PostCard key={p.id} post={p} adminMode />
            ))}
          </div>
        </>
      )}

      {myWaiting.length > 0 && (
        <>
          <SectionTitle>Mga post mo na hindi pa approved</SectionTitle>
          <div className="space-y-3">
            {myWaiting.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </>
      )}

      <div className="mt-5">
        <FilterTabs<Tab>
          label="Salain ang mga post"
          value={tab}
          onChange={setTab}
          options={[
            { value: "lahat", label: "Lahat" },
            { value: "purok", label: "Purok ko" },
            { value: "akin", label: "Post ko" },
          ]}
        />
      </div>
      <div className="mt-3" />
      {approved.loading ? (
        <Spinner />
      ) : approved.error ? (
        <ErrorText>{approved.error}</ErrorText>
      ) : feed.length === 0 ? (
        <EmptyState icon={<MessagesSquare className="h-12 w-12" />} title={tab === "lahat" ? "Wala pang post" : tab === "purok" ? "Wala pang post sa Purok mo" : "Wala ka pang post"}>
          {tab === "lahat" ? "Maging una sa pagbahagi ng balita." : tab === "purok" && !profile?.purok ? "Ilagay muna ang Purok mo sa Account." : ""}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {feed.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}
