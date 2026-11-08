"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { Heart, MessageCircle, Send, Trash2, UserRound, Check, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { friendlyError, sortNewest, timeAgo } from "@/lib/format";
import type { Comment, Post } from "@/lib/types";
import { Badge, Button } from "./ui";
import { useToast } from "./Toast";
import { VerifiedBadge } from "./VerifiedBadge";
import { useVerifiedSet } from "@/lib/useVerifiedSet";
import { logActivity } from "@/lib/activity";

function Comments({ postId }: { postId: string }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const q = useMemo(() => query(collection(db, "comments"), where("postId", "==", postId)), [postId]);
  const { data, loading } = useCollection<Comment>(q);
  const comments = useMemo(() => sortNewest(data).reverse(), [data]); // oldest first like FB
  const verified = useVerifiedSet();

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, "comments"), {
        postId,
        authorId: user.uid,
        authorName: profile?.fullName ?? user.displayName ?? "Residente",
        text: text.trim().slice(0, 1000),
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {loading ? (
        <p className="text-sm text-gray-500">Naglo-load ng comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-500">Wala pang comment. Ikaw na ang mauna!</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-2xl bg-surface px-3 py-2">
              <p className="text-sm font-bold">{c.authorName}<VerifiedBadge show={verified.has(c.authorId)} className="ml-0.5 align-[-2px]" /></p>
              <p className="whitespace-pre-line text-gray-800">{c.text}</p>
              <p className="text-xs text-gray-400">{timeAgo(c.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
      {user ? (
        <form onSubmit={handleSend} className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Sumulat ng comment..."
            maxLength={1000}
            className="flex-1 rounded-full border-2 border-gray-200 px-4 py-2 outline-none focus:border-brand"
            aria-label="Comment"
          />
          <button type="submit" disabled={sending || !text.trim()} className="rounded-full bg-brand p-3 text-white disabled:opacity-50" aria-label="I-send">
            <Send className="h-5 w-5" />
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-gray-600">
          <Link href="/login" className="font-bold text-brand underline">Mag-login</Link> para makapag-comment.
        </p>
      )}
    </div>
  );
}

export function PostCard({ post, adminMode = false }: { post: Post; adminMode?: boolean }) {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const [showComments, setShowComments] = useState(false);
  const [busy, setBusy] = useState(false);
  const liked = !!user && post.likes.includes(user.uid);
  const verified = useVerifiedSet();

  const toggleLike = async () => {
    if (!user) {
      toast("Mag-login muna para maka-like.", "error");
      return;
    }
    try {
      await updateDoc(doc(db, "posts", post.id), { likes: liked ? arrayRemove(user.uid) : arrayUnion(user.uid) });
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const setStatus = async (status: "approved" | "rejected") => {
    setBusy(true);
    try {
      await updateDoc(doc(db, "posts", post.id), { status });
      logActivity("Board", `${status === "approved" ? "Nag-approve" : "Nag-reject"} ng post ni ${post.authorName}`, post.id);
      toast(status === "approved" ? "Na-approve ang post." : "Na-reject ang post.");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Sigurado ka bang buburahin ang post na ito?")) return;
    try {
      await deleteDoc(doc(db, "posts", post.id));
      toast("Nabura ang post.");
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const canDelete = !!user && (isAdmin || post.authorId === user.uid);

  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <header className="mb-2 flex items-center gap-3">
        <span className="rounded-full bg-brand-light p-2 text-brand">
          <UserRound className="h-6 w-6" aria-hidden />
        </span>
        <div className="flex-1">
          <p className="font-bold leading-tight">{post.authorName}<VerifiedBadge show={verified.has(post.authorId)} className="ml-0.5 align-[-2px]" /></p>
          <p className="text-sm text-gray-500">
            {post.purok} · {timeAgo(post.createdAt)}
          </p>
        </div>
        {post.status !== "approved" && <Badge color={post.status === "pending" ? "gold" : "red"}>{post.status === "pending" ? "Naghihintay" : "Rejected"}</Badge>}
        {canDelete && (
          <button onClick={remove} className="rounded-full p-2 text-gray-400 active:bg-gray-100" aria-label="Burahin">
            <Trash2 className="h-5 w-5" />
          </button>
        )}
      </header>

      <p className="whitespace-pre-line text-gray-800">{post.content}</p>
      {post.photoURL && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.photoURL} alt="Larawan ng post" loading="lazy" className="mt-3 max-h-[480px] w-full rounded-xl object-cover" />
      )}

      {adminMode ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button onClick={() => setStatus("approved")} loading={busy}><Check className="h-5 w-5" /> Approve</Button>
          <Button variant="danger" onClick={() => setStatus("rejected")} loading={busy}><X className="h-5 w-5" /> Reject</Button>
        </div>
      ) : post.status === "approved" ? (
        <>
          <div className="mt-3 flex border-t border-gray-100 pt-2">
            <button onClick={toggleLike} className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 font-semibold active:bg-gray-100 ${liked ? "text-red-600" : "text-gray-600"}`} aria-pressed={liked}>
              <Heart className={`h-6 w-6 ${liked ? "fill-red-600" : ""}`} /> {post.likes.length} Like
            </button>
            <button onClick={() => setShowComments((s) => !s)} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 font-semibold text-gray-600 active:bg-gray-100">
              <MessageCircle className="h-6 w-6" /> Comment
            </button>
          </div>
          {showComments && <Comments postId={post.id} />}
        </>
      ) : null}
    </article>
  );
}
