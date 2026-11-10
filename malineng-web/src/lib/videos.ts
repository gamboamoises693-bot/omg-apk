import type { Timestamp } from "firebase/firestore";

export type VideoKind = "youtube" | "facebook" | "file" | "upload";

export interface Video {
  id: string;
  title: string;
  /** Original link pasted by the admin. */
  url: string;
  kind: VideoKind;
  /** YouTube id; empty for the other kinds. */
  videoId: string;
  /** Lower = earlier. New videos get a negative timestamp so they start first. */
  order: number;
  views: number;
  /** Hidden videos are not shown on Home (only the Super Admin sees them in Admin). */
  hidden?: boolean;
  /** Everyone who reacted, and uid -> reaction key (same shape as posts). */
  likes?: string[];
  reactions?: Record<string, string>;
  /** Uploaded videos only: number of chunk documents, mime type, size in bytes and a JPEG thumbnail. */
  chunks?: number;
  mime?: string;
  size?: number;
  thumb?: string;
  createdAt?: Timestamp;
}

export const VIDEO_HELP = "YouTube, Facebook (public) o direktang .mp4 link";

/** Recognize a pasted link. Returns null when it is not a supported video link. */
export function parseVideoUrl(raw: string): { kind: VideoKind; videoId: string; url: string } | null {
  const text = raw.trim();
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return /^[\w-]{11}$/.test(id) ? { kind: "youtube", videoId: id, url: text } : null;
  }
  if (host === "youtube.com" || host === "music.youtube.com") {
    const fromQuery = u.searchParams.get("v");
    const fromPath = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1];
    const id = fromQuery ?? fromPath ?? "";
    return /^[\w-]{11}$/.test(id) ? { kind: "youtube", videoId: id, url: text } : null;
  }
  if (host === "facebook.com" || host === "fb.watch") {
    return { kind: "facebook", videoId: "", url: text };
  }
  if (/\.(mp4|webm|mov)$/i.test(u.pathname)) {
    return { kind: "file", videoId: "", url: text };
  }
  return null;
}

export function youtubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function embedUrl(v: Pick<Video, "kind" | "videoId" | "url">): string {
  if (v.kind === "upload") return "";
  if (v.kind === "youtube") return `https://www.youtube-nocookie.com/embed/${v.videoId}?autoplay=1&rel=0&playsinline=1`;
  if (v.kind === "facebook") return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(v.url)}&show_text=false&autoplay=true`;
  return v.url;
}

/** Count a view once per device and video. */
const SEEN_KEY = "malineng-videos-seen";
export function alreadyCounted(id: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]).includes(id);
  } catch {
    return false;
  }
}
export function markCounted(id: string): void {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen.slice(-200), id]));
  } catch {
    // Private mode: the view simply may count again next time.
  }
}

/* ---- Resume where the viewer stopped (per device) ---- */
const POS_KEY = "malineng-video-pos";
type Positions = Record<string, number>;
function readPositions(): Positions {
  try {
    return JSON.parse(localStorage.getItem(POS_KEY) ?? "{}") as Positions;
  } catch {
    return {};
  }
}
export function getSavedPosition(id: string): number {
  return readPositions()[id] ?? 0;
}
/** Pass 0 to forget (video finished). Keeps only the 50 most recent videos. */
export function savePosition(id: string, seconds: number): void {
  try {
    const all = readPositions();
    delete all[id];
    if (seconds > 0) all[id] = Math.floor(seconds);
    const entries = Object.entries(all).slice(-50);
    localStorage.setItem(POS_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Storage blocked: playback just starts from the beginning next time.
  }
}
