"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { addDoc, collection, deleteDoc, doc, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { Flag, Send, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { friendlyError, sortNewest, timeAgo } from "@/lib/format";
import { REPORT_REASONS } from "@/lib/chat";
import { useVerifiedSet } from "@/lib/useVerifiedSet";
import type { Timestamp } from "firebase/firestore";
import { Avatar } from "./Avatar";
import { EmojiBar, avatarClass } from "./PostCard";
import { Button, ErrorText, Modal } from "./ui";
import { VerifiedBadge } from "./VerifiedBadge";
import { useToast } from "./Toast";

interface VideoComment {
  id: string;
  videoId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt?: Timestamp;
}

/** Comments under a Home video. Residents can report a comment; officers remove it. */
export function VideoComments({ videoId }: { videoId: string }) {
  const { user, profile, isOfficer } = useAuth();
  const toast = useToast();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState<VideoComment | null>(null);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [error, setError] = useState("");
  const verified = useVerifiedSet();
  const q = useMemo(() => query(collection(db, "videoComments"), where("videoId", "==", videoId)), [videoId]);
  const { data, loading } = useCollection<VideoComment>(q);
  const comments = useMemo(() => sortNewest(data).reverse(), [data]); // oldest first

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !text.trim()) return;
    setSending(true);
    setError("");
    try {
      await addDoc(collection(db, "videoComments"), {
        videoId,
        authorId: user.uid,
        authorName: profile.fullName,
        text: text.trim().slice(0, 1000),
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSending(false);
    }
  };

  const remove = async (c: VideoComment) => {
    if (!confirm("Burahin ang comment na ito?")) return;
    try {
      await deleteDoc(doc(db, "videoComments", c.id));
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const report = async () => {
    if (!user || !reporting) return;
    try {
      await setDoc(doc(db, "videoCommentReports", `${reporting.id}_${user.uid}`), {
        videoId,
        commentId: reporting.id,
        commentText: reporting.text.slice(0, 1000),
        commentAuthorId: reporting.authorId,
        commentAuthorName: reporting.authorName,
        reporterId: user.uid,
        reason,
        status: "open",
        createdAt: serverTimestamp(),
      });
      toast("Naipadala ang report. Salamat po!");
    } catch (err) {
      // A second report of the same comment is simply refused: say so kindly.
      toast(/permission|insufficient/i.test(String(err)) ? "Na-report mo na ang comment na ito." : friendlyError(err), "error");
    } finally {
      setReporting(null);
    }
  };

  return (
    <div className="mt-3 rounded-2xl bg-gray-50/80 px-3 pb-3 pt-3">
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
                  {user && c.authorId !== user.uid && (
                    <button type="button" onClick={() => { setReporting(c); setReason(REPORT_REASONS[0]); }} className="flex items-center gap-0.5 font-semibold text-amber-700 active:underline">
                      <Flag className="h-3 w-3" aria-hidden /> I-report
                    </button>
                  )}
                  {user && (isOfficer || c.authorId === user.uid) && (
                    <button type="button" onClick={() => remove(c)} className="flex items-center gap-0.5 font-semibold text-red-600 active:underline">
                      <Trash2 className="h-3 w-3" aria-hidden /> Burahin
                    </button>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {user ? (
        <form onSubmit={send} className="mt-3 flex flex-wrap items-center gap-2">
          <div className="w-full"><EmojiBar onPick={(e) => setText((t) => (t + e).slice(0, 1000))} /></div>
          <Avatar name={profile?.fullName ?? "Ako"} photo={profile?.photoURL} size="h-8 w-8" textClass="text-xs" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Sumulat ng comment..."
            maxLength={1000}
            aria-label="Comment sa video"
            className="min-w-0 flex-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-[0.95rem] outline-none focus:border-brand"
          />
          <button type="submit" disabled={sending || !text.trim()} className="rounded-full bg-brand p-2.5 text-white disabled:opacity-40 active:bg-brand-dark" aria-label="I-send">
            <Send className="h-[1.1rem] w-[1.1rem]" />
          </button>
          <div className="w-full"><ErrorText>{error}</ErrorText></div>
        </form>
      ) : (
        <p className="mt-3 text-sm text-gray-600">
          <Link href="/login" className="font-bold text-brand underline">Mag-login</Link> para makapag-comment.
        </p>
      )}

      <Modal open={!!reporting} onClose={() => setReporting(null)} title="I-report ang comment">
        {reporting && (
          <div className="space-y-3">
            <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <b>{reporting.authorName}:</b> {reporting.text}
            </p>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="vreason" checked={reason === r} onChange={() => setReason(r)} className="accent-brand" /> {r}
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setReporting(null)}>Kanselahin</Button>
              <Button onClick={report}>Ipadala</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
