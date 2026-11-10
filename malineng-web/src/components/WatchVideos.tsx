"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, increment, updateDoc } from "firebase/firestore";
import { Clapperboard, Eye, Play } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { loadVideoBlob } from "@/lib/videoUpload";
import { alreadyCounted, embedUrl, markCounted, youtubeThumb, type Video } from "@/lib/videos";

const videosRef = collection(db, "videos");

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

/** Home: one player + a strip of thumbnails. Every video of the barangay lives here. */
export function WatchVideos() {
  const { isStaff } = useAuth();
  const { data, loading } = useCollection<Video>(videosRef);
  const [open, setOpen] = useState(true);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  // Uploaded videos are downloaded from Firestore, then played from memory.
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadPct, setLoadPct] = useState<number | null>(null);
  const [loadError, setLoadError] = useState("");

  const videos = useMemo(() => [...data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [data]);
  const current = videos.find((v) => v.id === currentId) ?? videos[0];

  // If the playing video was deleted, go back to the first one.
  useEffect(() => {
    if (currentId && !videos.some((v) => v.id === currentId)) {
      setCurrentId(null);
      setPlaying(false);
    }
  }, [videos, currentId]);

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

      {open &&
        (!current ? (
          <p className="mt-3 rounded-2xl bg-gray-50 p-4 text-center text-sm text-gray-600">
            Wala pang video.{isStaff ? " Magdagdag sa Admin › Videos." : " Abangan ang mga paparating."}
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
                      // Browser-recorded files have no length in the header: seek far once so the player learns it.
                      const el = e.currentTarget;
                      if (current.kind === "upload" && el.duration === Infinity) {
                        el.currentTime = 1e101;
                        el.ontimeupdate = () => {
                          el.ontimeupdate = null;
                          el.currentTime = 0;
                        };
                      }
                    }}
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
              <p className="min-w-0 text-base font-extrabold leading-snug">▶ {current.title}</p>
              <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-gray-500">
                <Eye className="h-4 w-4" aria-hidden /> {(current.views ?? 0).toLocaleString("en-PH")} views
              </span>
            </div>

            {videos.length > 1 && (
              <>
                <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-gray-500">
                  <Clapperboard className="h-4 w-4" aria-hidden /> Choose a video:
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
                        <span className={`block aspect-video overflow-hidden rounded-xl bg-black ${active ? "ring-[3px] ring-brand" : ""}`}>
                          <Thumb v={v} />
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
    </section>
  );
}
