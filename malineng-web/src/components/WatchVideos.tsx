"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getCountFromServer, increment, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import Link from "next/link";
import { Clapperboard, Eye, Megaphone, MessageCircle, Play } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { devRoomOf } from "@/lib/chat";
import { useCollection } from "@/lib/useCollection";
import { loadVideoBlob } from "@/lib/videoUpload";
import { DEVELOPER_NAME, DEVELOPER_URL } from "@/lib/constants";
import { LikeButton, ReactionCounts, ReactionSummary, reactionPatch, useReactions } from "./ReactionBar";
import { VideoComments } from "./VideoComments";
import { alreadyCounted, embedUrl, getSavedPosition, markCounted, rememberWatchMark, savePosition, watchMarkFresh, youtubeThumb, type Video } from "@/lib/videos";

const videosRef = collection(db, "videos");
const NO_LIKES: string[] = [];

function Thumb({ v, className = "" }: { v: Video; className?: string }) {
  if (v.thumb) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={v.thumb} alt="" className={`h-full w-full object-cover ${className}`} />;
  }
  if (v.kind === "youtube") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={youtubeThumb(v.videoId)} alt="" loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  }
  return (
    <span className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-brand to-brand-deep text-white ${className}`}>
      <Clapperboard className="h-7 w-7" aria-hidden />
    </span>
  );
}

/** Reactions and comments for the video that is selected. Re-created per video, so counts never mix. */
function VideoSocial({ video }: { video: Video }) {
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState<number | null>(null);
  const r = useReactions({
    likes: video.likes ?? NO_LIKES,
    reactions: video.reactions,
    save: (uid, key) => updateDoc(doc(db, "videos", video.id), reactionPatch(uid, key)),
  });

  // Cheap count so the bar can say "3 comments" before the comments are opened.
  useEffect(() => {
    getCountFromServer(query(collection(db, "videoComments"), where("videoId", "==", video.id)))
      .then((s) => setCommentCount(s.data().count))
      .catch(() => {});
  }, [video.id, showComments]);

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between px-1 pb-1.5 pt-1 text-sm text-gray-500">
        <ReactionCounts r={r} />
        {(commentCount ?? 0) > 0 && (
          <button type="button" onClick={() => setShowComments(true)} className="active:underline">
            {commentCount} comment{commentCount === 1 ? "" : "s"}
          </button>
        )}
      </div>
      <div className="flex border-t border-gray-100 py-1">
        <LikeButton r={r} />
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          aria-expanded={showComments}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[0.95rem] font-semibold active:bg-gray-100 ${showComments ? "text-brand" : "text-gray-600"}`}
        >
          <MessageCircle className="h-5 w-5" /> Comment
        </button>
      </div>
      {showComments && <VideoComments videoId={video.id} />}
      <ReactionSummary r={r} />
    </div>
  );
}

/** Small "AD" label, with the name of the business when there is one. */
function AdBadge({ v, className = "" }: { v: Video; className?: string }) {
  if (!v.ad) return null;
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full bg-[#B3202B] px-2 py-0.5 text-[0.65rem] font-extrabold tracking-wide text-white ${className}`}>
      <Megaphone className="h-3 w-3 shrink-0" aria-hidden /> <span className="truncate">AD{v.sponsor ? ` · ${v.sponsor}` : ""}</span>
    </span>
  );
}

/** For the Ads tab: businesses cannot upload by themselves, so they ask the Developer. */
function AdContact() {
  const { user, isSuperAdmin } = useAuth();
  return (
    <div className="mt-3 space-y-2 rounded-2xl border-2 border-dashed border-gold bg-gold-light/50 p-4 text-sm">
      <p className="font-extrabold">Gusto mong i-advertise ang negosyo mo?</p>
      <p className="text-gray-700">Magpa-upload ng video ad dito sa Home. Makipag-ugnayan lang sa Developer, at siya ang maglalagay nito.</p>
      <Link
        // The Developer opens the inbox (who wrote to them); everyone else opens their own chat with the Developer.
        href={isSuperAdmin ? "/chat/" : user ? `/chat/?room=${encodeURIComponent(devRoomOf(user.uid))}` : "/login"}
        className="flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-center font-bold text-white"
      >
        <MessageCircle className="h-4 w-4" aria-hidden /> {isSuperAdmin ? "Buksan ang mga mensahe sa Developer" : user ? `Mag-chat kay ${DEVELOPER_NAME}` : "Mag-login para makausap ang Developer"}
      </Link>
      {DEVELOPER_URL && (
        <a href={DEVELOPER_URL} target="_blank" rel="noopener noreferrer" className="block rounded-xl bg-white py-2 text-center font-bold text-brand">
          O kontakin sa Facebook
        </a>
      )}
    </div>
  );
}

/** Home: one player + a strip of thumbnails. Every video of the barangay lives here. */
export function WatchVideos() {
  const { isStaff, user, profile } = useAuth();
  const { data, loading } = useCollection<Video>(videosRef);
  const [open, setOpen] = useState(true);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  // Uploaded videos are downloaded from Firestore, then played from memory.
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadPct, setLoadPct] = useState<number | null>(null);
  const [loadError, setLoadError] = useState("");

  // "Videos" are the barangay's own; "Ads" are videos of local businesses.
  const [tab, setTab] = useState<"video" | "ad">("video");
  const all = useMemo(() => data.filter((v) => !v.hidden).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [data]);
  const adCount = useMemo(() => all.filter((v) => v.ad).length, [all]);
  const videos = useMemo(() => all.filter((v) => (tab === "ad" ? v.ad : !v.ad)), [all, tab]);
  const current = videos.find((v) => v.id === currentId) ?? videos[0];

  // If the playing video was deleted, go back to the first one.
  useEffect(() => {
    if (currentId && !videos.some((v) => v.id === currentId)) {
      setCurrentId(null);
      setPlaying(false);
    }
  }, [videos, currentId]);

  // Continue where the viewer stopped: skip tiny positions and the last few seconds.
  const lastSaved = useRef(0);
  function resume(el: HTMLVideoElement, id: string) {
    const at = getSavedPosition(id);
    lastSaved.current = at;
    if (at > 3 && Number.isFinite(el.duration) && at < el.duration - 3) el.currentTime = at;
  }

  // Free the memory of the previous uploaded video.
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  async function play() {
    if (!current) return;
    setLoadError("");
    if (current.kind === "upload") {
      try {
        setLoadPct(0);
        const blob = await loadVideoBlob(current.id, current.mime ?? "video/mp4", setLoadPct);
        setBlobUrl(URL.createObjectURL(blob));
      } catch {
        setLoadError("Hindi ma-load ang video. I-check ang internet at subukan ulit.");
        setLoadPct(null);
        return;
      }
      setLoadPct(null);
    }
    setPlaying(true);
    if (!alreadyCounted(current.id)) {
      markCounted(current.id);
      updateDoc(doc(db, "videos", current.id), { views: increment(1) }).catch(() => {});
    }
    // Logged-in viewers leave one small mark per video (name and purok) that the Developer can read.
    if (user && profile && !watchMarkFresh(current.id)) {
      rememberWatchMark(current.id);
      setDoc(doc(db, "videos", current.id, "viewers", user.uid), { name: profile.fullName, purok: profile.purok ?? "", at: serverTimestamp() }).catch(() => {});
    }
  }

  if (loading) return null;

  return (
    <section className="mt-4 rounded-3xl bg-white p-4 shadow-card" aria-label="Mga video">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2 text-lg font-extrabold">
          <Clapperboard className="h-5 w-5 text-brand" aria-hidden /> Watch Videos
        </span>
        <span className="text-sm text-gray-500" aria-hidden>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1" role="tablist" aria-label="Uri ng video">
          {(["video", "ad"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setCurrentId(null);
                setPlaying(false);
                setBlobUrl(null);
                setLoadError("");
              }}
              className={`rounded-lg py-2 text-sm font-bold ${tab === t ? "bg-white text-brand shadow-sm" : "text-gray-500"}`}
            >
              {t === "video" ? "Mga Video" : `Ads${adCount ? ` (${adCount})` : ""}`}
            </button>
          ))}
        </div>
      )}

      {open &&
        (!current ? (
          <p className="mt-3 rounded-2xl bg-gray-50 p-4 text-center text-sm text-gray-600">
            {tab === "ad" ? "Wala pang ad sa ngayon." : <>Wala pang video.{isStaff ? " Magdagdag sa Admin › Videos." : " Abangan ang mga paparating."}</>}
          </p>
        ) : (
          <div className="mt-3">
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
              {playing ? (
                current.kind === "file" || current.kind === "upload" ? (
                  <video
                    key={current.id}
                    src={current.kind === "upload" ? (blobUrl ?? "") : current.url}
                    controls
                    autoPlay
                    playsInline
                    preload="metadata"
                    className="h-full w-full"
                    onLoadedMetadata={(e) => {
                      const el = e.currentTarget;
                      // Browser-recorded files have no length in the header: seek far once so the player learns it.
                      if (current.kind === "upload" && el.duration === Infinity) {
                        el.dataset.probe = "1";
                        el.currentTime = 1e101;
                        el.ontimeupdate = () => {
                          el.ontimeupdate = null;
                          el.currentTime = 0;
                          delete el.dataset.probe;
                          resume(el, current.id);
                        };
                        return;
                      }
                      resume(el, current.id);
                    }}
                    onTimeUpdate={(e) => {
                      // Remember where the viewer is (about every 3 seconds).
                      const el = e.currentTarget;
                      if (el.dataset.probe) return;
                      if (Math.abs(el.currentTime - lastSaved.current) >= 3 && el.currentTime < 1e6) {
                        lastSaved.current = el.currentTime;
                        savePosition(current.id, el.currentTime);
                      }
                    }}
                    onPause={(e) => !e.currentTarget.ended && !e.currentTarget.dataset.probe && savePosition(current.id, e.currentTarget.currentTime)}
                    onEnded={() => savePosition(current.id, 0)}
                  />
                ) : (
                  <iframe
                    key={current.id}
                    src={embedUrl(current)}
                    title={current.title}
                    className="h-full w-full"
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                )
              ) : (
                <button type="button" onClick={play} className="group absolute inset-0" aria-label={`I-play ang ${current.title}`}>
                  <Thumb v={current} />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-brand shadow-lg group-active:scale-95">
                      {loadPct !== null ? <span className="text-sm font-extrabold">{loadPct}%</span> : <Play className="h-7 w-7 translate-x-0.5" fill="currentColor" aria-hidden />}
                    </span>
                  </span>
                </button>
              )}
            </div>

            {loadError && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{loadError}</p>}
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <AdBadge v={current} className="mb-1" />
                <p className="text-base font-extrabold leading-snug">▶ {current.title}</p>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-gray-500">
                <Eye className="h-4 w-4" aria-hidden /> {(current.views ?? 0).toLocaleString("en-PH")} views
              </span>
            </div>

            <p className="mt-1 text-[0.68rem] text-gray-400">Kapag naka-login ka, makikita ng Developer na nanood ka ng video na ito.</p>

            <VideoSocial key={current.id} video={current} />

            {videos.length > 1 && (
              <>
                <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-gray-500">
                  <Clapperboard className="h-4 w-4" aria-hidden /> {tab === "ad" ? "Choose an ad:" : "Choose a video:"}
                </p>
                <div className="no-scrollbar -mx-1 mt-2 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
                  {videos.map((v) => {
                    const active = v.id === current.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setCurrentId(v.id);
                          setPlaying(false);
                          setBlobUrl(null);
                          setLoadError("");
                        }}
                        aria-current={active}
                        className="w-36 shrink-0 snap-start text-left"
                      >
                        <span className={`relative block aspect-video overflow-hidden rounded-xl bg-black ${active ? "ring-[3px] ring-brand" : ""}`}>
                          <Thumb v={v} />
                          {v.ad && <span className="absolute left-1 top-1 rounded bg-[#B3202B] px-1 text-[0.6rem] font-extrabold text-white">AD</span>}
                        </span>
                        <span className={`mt-1 line-clamp-2 block text-xs leading-tight ${active ? "font-extrabold text-brand" : "text-gray-700"}`}>{v.title}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ))}
      {open && tab === "ad" && <AdContact />}
    </section>
  );
}
