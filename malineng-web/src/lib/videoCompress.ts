/**
 * Browser-only helpers that make a phone video small enough to keep in Firestore
 * (the free plan has no file storage). No server and no paid service is used.
 */

/** Files up to this size are kept as they are. */
export const KEEP_AS_IS_BYTES = 8 * 1024 * 1024;
/** Hard limit for what is stored. */
export const MAX_VIDEO_BYTES = 12 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 120;

export interface PreparedVideo {
  blob: Blob;
  mime: string;
  /** Small JPEG data URL used as the thumbnail. */
  thumb: string;
}

export type Progress = (label: string, percent: number) => void;

function waitFor(el: HTMLVideoElement, ok: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      el.removeEventListener(ok, onOk);
      el.removeEventListener("error", onErr);
    };
    const onOk = () => (done(), resolve());
    const onErr = () => (done(), reject(new Error("Hindi mabasa ng browser ang video na ito. Subukan ang .mp4 (H.264).")));
    el.addEventListener(ok, onOk);
    el.addEventListener("error", onErr);
  });
}

async function makeThumb(video: HTMLVideoElement): Promise<string> {
  try {
    video.currentTime = Math.min(1, video.duration / 2);
    await waitFor(video, "seeked");
    const width = Math.min(320, video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.round((video.videoHeight * width) / video.videoWidth);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return "";
  }
}

function pickMime(): string {
  const options = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

/** Play the video once into a canvas and record it again at 640px wide and a low bitrate. */
async function recompress(video: HTMLVideoElement, onProgress: Progress): Promise<Blob> {
  if (typeof MediaRecorder === "undefined") throw new Error("Hindi kayang i-compress ng browser na ito ang video. Gamitin ang Chrome.");
  const mime = pickMime();
  const scale = Math.min(1, 640 / video.videoWidth);
  const cw = Math.max(2, Math.round((video.videoWidth * scale) / 2) * 2);
  const ch = Math.max(2, Math.round((video.videoHeight * scale) / 2) * 2);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Hindi mabuksan ang canvas ng browser.");

  const stream = canvas.captureStream(24);
  // Route the sound into the recording only (never to the speaker).
  let audio: AudioContext | null = null;
  try {
    audio = new AudioContext();
    const source = audio.createMediaElementSource(video);
    const dest = audio.createMediaStreamDestination();
    source.connect(dest);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  } catch {
    // No audio track: the clip is silent but still works.
  }

  const recorder = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 650_000, audioBitsPerSecond: 64_000 });
  const parts: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size > 0 && parts.push(e.data);
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));

  video.currentTime = 0;
  recorder.start(1000);
  const timer = window.setInterval(() => {
    ctx.drawImage(video, 0, 0, cw, ch);
    onProgress("Kino-compress ang video. Huwag umalis sa page", Math.min(99, Math.round((video.currentTime / video.duration) * 100)));
  }, 1000 / 24);
  try {
    await video.play();
  } catch {
    // Autoplay with sound was refused: continue silently rather than fail.
    video.muted = true;
    await video.play();
  }
  await new Promise<void>((resolve) => (video.onended = () => resolve()));
  window.clearInterval(timer);
  ctx.drawImage(video, 0, 0, cw, ch);
  recorder.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  void audio?.close();
  return new Blob(parts, { type: recorder.mimeType || mime || "video/webm" });
}

/**
 * Check the file, make a thumbnail, and shrink it when it is bigger than KEEP_AS_IS_BYTES.
 * `forceCompress` is only used by tests.
 */
export async function prepareVideo(file: File, onProgress: Progress, forceCompress = false): Promise<PreparedVideo> {
  if (!file.type.startsWith("video/")) throw new Error("Video file lang ang pwede (hal. .mp4).");
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "auto";
    video.playsInline = true;
    video.src = url;
    await waitFor(video, "loadedmetadata");
    if (!Number.isFinite(video.duration) || video.duration > MAX_VIDEO_SECONDS) {
      throw new Error(`Masyadong mahaba ang video. Hanggang ${MAX_VIDEO_SECONDS / 60} minuto lang (o putulin muna).`);
    }
    onProgress("Inihahanda ang video", 0);
    const thumb = await makeThumb(video);
    if (!forceCompress && file.size <= KEEP_AS_IS_BYTES) return { blob: file, mime: file.type, thumb };

    const blob = await recompress(video, onProgress);
    if (blob.size > MAX_VIDEO_BYTES) {
      throw new Error(`Malaki pa rin ang video (${(blob.size / 1048576).toFixed(1)} MB) pagkatapos i-compress. Putulin muna ito (mga 60 segundo) o i-upload sa YouTube at i-paste ang link.`);
    }
    return { blob, mime: blob.type, thumb };
  } finally {
    URL.revokeObjectURL(url);
  }
}
