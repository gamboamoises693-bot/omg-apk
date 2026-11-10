"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { addDoc, collection, deleteDoc, doc, getCountFromServer, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { Check, Link2, MessageCircle, MoreHorizontal, Send, Share2, Trash2, X } from "lucide-react";
import { QUICK_EMOJIS } from "@/lib/reactions";
import { LikeButton, ReactionCounts, ReactionSummary, reactionPatch, useReactions } from "./ReactionBar";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { friendlyError, sortNewest, timeAgo } from "@/lib/format";
import type { Comment, Post } from "@/lib/types";
import { Avatar } from "./Avatar";
import { Badge, Button } from "./ui";
import { useToast } from "./Toast";
import { VerifiedBadge } from "./VerifiedBadge";
import { useVerifiedSet } from "@/lib/useVerifiedSet";
import { logActivity } from "@/lib/activity";

/** Same name = same colour, so people are easy to tell apart without photos. */
const PALETTE = ["bg-brand text-white", "bg-teal-600 text-white", "bg-amber-500 text-white", "bg-purple-600 text-white", "bg-rose-500 text-white", "bg-emerald-600 text-white"];
export function avatarClass(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

const LONG_TEXT = 280;

/** A row of emojis that adds the tapped one to the text being written. */
export function EmojiBar({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto py-1" role="group" aria-label="Mga emoji">
      {QUICK_EMOJIS.map((e) => (
        <button key={e} type="button" onClick={() => onPick(e)} className="shrink-0 rounded-lg px-1.5 py-0.5 text-xl active:bg-gray-200" aria-label={`Idagdag ang ${e}`}>
          {e}
        </button>
      ))}
    </div>
  );
}

function Comments({ postId, onCount }: { postId: string; onCount: (n: number) => void }) {
  const { user, profile, isAdmin } = useAuth();
  const toast = useToast();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const q = useMemo(() => query(collection(db, "comments"), where("postId", "==", postId)), [postId]);
  const { data, loading } = useCollection<Comment>(q);
  const comments = useMemo(() => sortNewest(data).reverse(), [data]); // oldest first like FB
  const verified = useVerifiedSet();

  useEffect(() => {
    if (!loading) onCount(data.length);
  }, [data.length, loading, onCount]);

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

  const removeComment = async (c: Comment) => {
    if (!confirm("Burahin ang comment na ito?")) return;
    try {
      await deleteDoc(doc(db, "comments", c.id));
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <div className="border-t border-gray-100 bg-gray-50/70 px-4 pb-4 pt-3">
      {loading ? (
        <p className="text-sm text-gray-500">Naglo-load ng comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-500">Wala pang comment. Ikaw na ang mauna!</p>
      ) : (
        <ul className="space-y-2.5">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2">
              <Avatar name={c.authorName} size="h-8 w-8" textClass="text-xs" fallbackClass={avatarClass(c.authorName)} />
              <div className="min-w-0">
                <div className="rounded-2xl rounded-tl-md bg-white px-3 py-1.5 shadow-sm ring-1 ring-gray-100">
                  <p className="text-[0.8rem] font-bold leading-tight">
                    {c.authorName}
                    <VerifiedBadge show={verified.has(c.authorId)} className="ml-0.5 align-[-2px]" />
                  </p>
                  <p className="whitespace-pre-line break-words text-[0.92rem] text-gray-800">{c.text}</p>
                </div>
                <p className="ml-3 mt-0.5 flex items-center gap-3 text-[0.68rem] text-gray-500">
                  {timeAgo(c.createdAt)}
                  {user && (isAdmin || c.authorId === user.uid) && (
                    <button type="button" onClick={() => removeComment(c)} className="font-semibold text-red-600 active:underline">
                      Burahin
                    </button>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {user ? (
        <form onSubmit={handleSend} className="mt-3 flex flex-wrap items-center gap-2">
          <div className="w-full"><EmojiBar onPick={(e) => setText((t) => (t + e).slice(0, 1000))} /></div>
          <Avatar name={profile?.fullName ?? "Ako"} photo={profile?.photoURL} size="h-8 w-8" textClass="text-xs" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Sumulat ng comment..."
            maxLength={1000}
            className="min-w-0 flex-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-[0.95rem] outline-none focus:border-brand"
            aria-label="Comment"
          />
          <button type="submit" disabled={sending || !text.trim()} className="rounded-full bg-brand p-2.5 text-white disabled:opacity-40 active:bg-brand-dark" aria-label="I-send">
            <Send className="h-[1.1rem] w-[1.1rem]" />
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
  const [expanded, setExpanded] = useState(false);
  const [menu, setMenu] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [commentCount, setCommentCount] = useState<number | null>(null);
  const verified = useVerifiedSet();
  const r = useReactions({
    likes: post.likes,
    reactions: post.reactions,
    save: (uid, key) => updateDoc(doc(db, "posts", post.id), reactionPatch(uid, key)),
  });

  // Cheap count so the card can say "3 comments" without loading them all. It is only asked for
  // when the card scrolls into view (each count costs one read on the free plan).
  const cardRef = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = cardRef.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") return setSeen(true);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  useEffect(() => {
    if (post.status !== "approved" || !seen) return;
    getCountFromServer(query(collection(db, "comments"), where("postId", "==", post.id)))
      .then((s) => setCommentCount(s.data().count))
      .catch(() => {});
  }, [post.id, post.status, seen]);

  const share = async () => {
    setMenu(false);
    const url = `${window.location.origin}/board/`;
    const snippet = post.content.length > 140 ? `${post.content.slice(0, 140)}…` : post.content;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Community Board ng Barangay Malineng", text: `${post.authorName}: ${snippet}`, url });
      } else {
        await navigator.clipboard.writeText(`${post.authorName}: ${snippet}\n${url}`);
        toast("Nakopya ang post at link.");
      }
    } catch {
      // The person closed the share sheet: nothing to report.
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
    setMenu(false);
    if (!confirm("Sigurado ka bang buburahin ang post na ito?")) return;
    try {
      await deleteDoc(doc(db, "posts", post.id));
      toast("Nabura ang post.");
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const canDelete = !!user && (isAdmin || post.authorId === user.uid);
  const long = post.content.length > LONG_TEXT;

  return (
    <article ref={cardRef} className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-gray-100">
      <header className="flex items-center gap-3 px-4 pt-4">
        <Avatar name={post.authorName} size="h-11 w-11" textClass="text-base" fallbackClass={avatarClass(post.authorName)} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-bold">
            {post.authorName}
            <VerifiedBadge show={verified.has(post.authorId)} className="ml-0.5 align-[-2px]" />
          </p>
          <p className="text-xs text-gray-500">
            {post.purok ? `${post.purok} · ` : ""}
            {timeAgo(post.createdAt)}
          </p>
        </div>
        {post.status !== "approved" && <Badge color={post.status === "pending" ? "gold" : "red"}>{post.status === "pending" ? "Naghihintay" : "Rejected"}</Badge>}
        {post.status === "approved" && (
          <div className="relative">
            <button type="button" onClick={() => setMenu((v) => !v)} className="rounded-full p-2 text-gray-500 active:bg-gray-100" aria-label="Higit pang aksyon" aria-expanded={menu}>
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {menu && (
              <>
                <button type="button" aria-label="Isara" className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(false)} />
                <div className="absolute right-0 top-9 z-40 w-48 overflow-hidden rounded-xl bg-white py-1 text-sm shadow-float ring-1 ring-gray-100">
                  <button type="button" onClick={share} className="flex w-full items-center gap-2 px-3 py-2.5 text-left active:bg-gray-50">
                    <Link2 className="h-4 w-4 text-gray-500" /> Ibahagi / Kopyahin
                  </button>
                  {canDelete && (
                    <button type="button" onClick={remove} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-red-600 active:bg-red-50">
                      <Trash2 className="h-4 w-4" /> Burahin ang post
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {post.status !== "approved" && canDelete && (
          <button type="button" onClick={remove} className="rounded-full p-2 text-gray-400 active:bg-gray-100" aria-label="Burahin">
            <Trash2 className="h-5 w-5" />
          </button>
        )}
      </header>

      <div className="px-4 pt-3">
        <p className={`whitespace-pre-line break-words text-[1rem] leading-relaxed text-gray-800 ${long && !expanded ? "line-clamp-6" : ""}`}>{post.content}</p>
        {long && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-sm font-semibold text-brand">
            {expanded ? "Tiklupin" : "Tingnan pa"}
          </button>
        )}
      </div>

      {post.photoURL && (
        <button type="button" onClick={() => setZoom(true)} className="mt-3 block w-full" aria-label="Palakihin ang larawan">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.photoURL} alt="Larawan ng post" loading="lazy" className="max-h-[480px] w-full object-cover" />
        </button>
      )}

      {adminMode ? (
        <div className="grid grid-cols-2 gap-2 p-4">
          <Button onClick={() => setStatus("approved")} loading={busy}><Check className="h-5 w-5" /> Approve</Button>
          <Button variant="danger" onClick={() => setStatus("rejected")} loading={busy}><X className="h-5 w-5" /> Reject</Button>
        </div>
      ) : post.status === "approved" ? (
        <>
          {/* Counts */}
          <div className="flex items-center justify-between px-4 pb-2 pt-3 text-sm text-gray-500">
            <ReactionCounts r={r} />
            {(commentCount ?? 0) > 0 && (
              <button type="button" onClick={() => setShowComments(true)} className="active:underline">
                {commentCount} comment{commentCount === 1 ? "" : "s"}
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="mx-2 flex border-t border-gray-100 py-1">
            <LikeButton r={r} />
            <button type="button" onClick={() => setShowComments((v) => !v)} aria-expanded={showComments} className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[0.95rem] font-semibold active:bg-gray-100 ${showComments ? "text-brand" : "text-gray-600"}`}>
              <MessageCircle className="h-5 w-5" /> Comment
            </button>
            <button type="button" onClick={share} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[0.95rem] font-semibold text-gray-600 active:bg-gray-100">
              <Share2 className="h-5 w-5" /> Ibahagi
            </button>
          </div>
          {showComments && <Comments postId={post.id} onCount={setCommentCount} />}
        </>
      ) : null}

      <ReactionSummary r={r} />

      {zoom && post.photoURL && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2" role="dialog" aria-modal="true" aria-label="Larawan" onClick={() => setZoom(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.photoURL} alt="Larawan ng post" className="max-h-full max-w-full object-contain" />
          <button type="button" aria-label="Isara" className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] rounded-full bg-white/20 p-2 text-white" onClick={() => setZoom(false)}>
            <X className="h-6 w-6" />
          </button>
        </div>
      )}
    </article>
  );
}
