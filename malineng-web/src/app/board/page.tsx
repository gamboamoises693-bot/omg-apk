"use client";

import { useMemo, useState, type FormEvent } from "react";
import { addDoc, collection, query, serverTimestamp, where } from "firebase/firestore";
import { MessagesSquare, PenSquare } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { uploadImage } from "@/lib/upload";
import { friendlyError, sortNewest } from "@/lib/format";
import type { Post } from "@/lib/types";
import { Button, Card, EmptyState, ErrorText, PageHeader, SectionTitle, Spinner, Textarea } from "@/components/ui";
import { ImagePicker } from "@/components/ImagePicker";
import { LoginGate } from "@/components/LoginGate";
import { PostCard } from "@/components/PostCard";
import { useToast } from "@/components/Toast";

function CreatePost() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      setContent("");
      setFile(null);
      toast("Naipadala! Lalabas ang post kapag na-approve ng admin.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea label="Ano ang gusto mong ibahagi?" placeholder="Hal. May libreng bakuna sa Health Center bukas..." value={content} onChange={(e) => setContent(e.target.value)} maxLength={3000} />
        <ImagePicker file={file} onChange={setFile} />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" full loading={loading}>
          <PenSquare className="h-5 w-5" /> I-post
        </Button>
        <p className="text-center text-sm text-gray-500">Ire-review muna ng admin bago lumabas.</p>
      </form>
    </Card>
  );
}

export default function BoardPage() {
  const { user, isAdmin } = useAuth();
  const approvedQ = useMemo(() => query(collection(db, "posts"), where("status", "==", "approved")), []);
  const pendingQ = useMemo(() => (isAdmin ? query(collection(db, "posts"), where("status", "==", "pending")) : null), [isAdmin]);
  const mineQ = useMemo(() => (user && !isAdmin ? query(collection(db, "posts"), where("authorId", "==", user.uid)) : null), [user, isAdmin]);

  const approved = useCollection<Post>(approvedQ);
  const pending = useCollection<Post>(pendingQ);
  const mine = useCollection<Post>(mineQ);

  const feed = useMemo(() => sortNewest(approved.data), [approved.data]);
  const myWaiting = useMemo(() => sortNewest(mine.data.filter((p) => p.status !== "approved")), [mine.data]);

  return (
    <div>
      <PageHeader title="Community Board" subtitle="Balita at usapan ng mga taga-Malineng" />

      <LoginGate message="Mag-login para makapag-post sa Community Board.">
        <CreatePost />
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

      <SectionTitle>Pinakabagong Post</SectionTitle>
      {approved.loading ? (
        <Spinner />
      ) : approved.error ? (
        <ErrorText>{approved.error}</ErrorText>
      ) : feed.length === 0 ? (
        <EmptyState icon={<MessagesSquare className="h-12 w-12" />} title="Wala pang post" />
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
