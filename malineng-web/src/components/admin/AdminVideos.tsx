"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { ArrowUpToLine, Clapperboard, Eye, EyeOff, Pencil, Trash2, Upload } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { logActivity } from "@/lib/activity";
import { friendlyError } from "@/lib/format";
import { useCollection } from "@/lib/useCollection";
import { MAX_VIDEO_SECONDS, prepareVideo } from "@/lib/videoCompress";
import { deleteVideoChunks, uploadVideoChunks } from "@/lib/videoUpload";
import { VIDEO_HELP, parseVideoUrl, youtubeThumb, type Video } from "@/lib/videos";
import { Button, Card, EmptyState, ErrorText, Input, Modal, Spinner } from "@/components/ui";

const videosRef = collection(db, "videos");
const KIND_LABEL = { youtube: "YouTube", facebook: "Facebook", file: "MP4", upload: "Upload" } as const;

/** Admin: add, rename, reorder and remove the videos shown on Home. */
export function AdminVideos() {
  const { data, loading } = useCollection<Video>(videosRef);
  const videos = useMemo(() => [...data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [data]);
  const [editing, setEditing] = useState<Video | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { isSuperAdmin } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<{ label: string; pct: number } | null>(null);

  function startEdit(v: Video | null) {
    setEditing(v);
    setTitle(v?.title ?? "");
    setUrl(v?.url ?? "");
    setError("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const name = title.trim().replace(/\s+/g, " ");
    if (!name) return setError("Isulat ang pamagat.");
    if (editing?.kind === "upload") {
      setBusy(true);
      try {
        await updateDoc(doc(db, "videos", editing.id), { title: name.slice(0, 100) });
        logActivity("Videos", `Binago ang video: ${name}`, editing.id);
        setEditing(null);
        setTitle("");
      } catch (err) {
        setError(friendlyError(err));
      } finally {
        setBusy(false);
      }
      return;
    }
    const parsed = parseVideoUrl(url);
    if (!parsed) return setError(`Hindi suportadong link. Gamitin ang ${VIDEO_HELP}.`);
    setBusy(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "videos", editing.id), { title: name.slice(0, 100), url: parsed.url, kind: parsed.kind, videoId: parsed.videoId });
        logActivity("Videos", `Binago ang video: ${name}`, editing.id);
      } else {
        // Negative timestamp = newest first, without renumbering the others.
        const ref = await addDoc(videosRef, { title: name.slice(0, 100), url: parsed.url, kind: parsed.kind, videoId: parsed.videoId, order: -Date.now(), views: 0, createdAt: serverTimestamp() });
        logActivity("Videos", `Nagdagdag ng video: ${name}`, ref.id);
      }
      setEditing(null);
      setTitle("");
      setUrl("");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  /** Super Admin: shrink the file in the phone, then keep it in Firestore as chunks. */
  async function uploadFile(file: File | undefined) {
    if (!file) return;
    setError("");
    const name = title.trim().replace(/\s+/g, " ");
    if (!name) {
      setError("Isulat muna ang pamagat bago pumili ng video.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setBusy(true);
    const id = doc(videosRef).id;
    try {
      const prepared = await prepareVideo(file, (label, pct) => setPhase({ label, pct }));
      setPhase({ label: "Ina-upload ang video", pct: 0 });
      const chunks = await uploadVideoChunks(id, prepared.blob, (done, total) => setPhase({ label: "Ina-upload ang video", pct: Math.round((done / total) * 100) }));
      await setDoc(doc(db, "videos", id), {
        title: name.slice(0, 100),
        url: "",
        kind: "upload",
        videoId: "",
        order: -Date.now(),
        views: 0,
        chunks,
        mime: prepared.mime.slice(0, 60),
        size: prepared.blob.size,
        thumb: prepared.thumb,
        createdAt: serverTimestamp(),
      });
      logActivity("Videos", `Nag-upload ng video: ${name} (${(prepared.blob.size / 1048576).toFixed(1)} MB)`, id);
      setTitle("");
    } catch (err) {
      // Do not leave half-uploaded pieces behind.
      deleteVideoChunks(id).catch(() => {});
      setError(friendlyError(err));
    } finally {
      setBusy(false);
      setPhase(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function moveFirst(v: Video) {
    try {
      const min = Math.min(...videos.map((x) => x.order ?? 0));
      await updateDoc(doc(db, "videos", v.id), { order: min - 1 });
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function toggleHidden(v: Video) {
    try {
      await updateDoc(doc(db, "videos", v.id), { hidden: !v.hidden });
      logActivity("Videos", `${v.hidden ? "Ipinakita" : "Itinago"} ang video: ${v.title}`, v.id);
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function remove(v: Video) {
    if (!window.confirm(`Burahin ang "${v.title}"?`)) return;
    try {
      if (v.kind === "upload") await deleteVideoChunks(v.id);
      await deleteDoc(doc(db, "videos", v.id));
      logActivity("Videos", `Binura ang video: ${v.title}`, v.id);
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  const formOpen = editing !== null;
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Super Admin lang ang makakapaglagay, makakapagtago at makakapagbura ng video. Ang pinakauna sa listahan ang unang lalabas sa Home. Ang naka-tago (👁️ na may guhit) ay hindi nakikita ng mga residente. Ang link ay {VIDEO_HELP}.</p>

      <form onSubmit={formOpen ? (ev) => ev.preventDefault() : submit} className="space-y-3 rounded-2xl bg-white p-4 shadow-card">
        <p className="text-xs font-bold tracking-wide text-gray-600">BAGONG VIDEO</p>
        <Input label="Pamagat" value={formOpen ? "" : title} onChange={(e) => setTitle(e.target.value)} placeholder="hal. Paano mag-request ng Clearance" maxLength={100} disabled={formOpen} />
        <Input label="Link ng video" value={formOpen ? "" : url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtu.be/..." inputMode="url" disabled={formOpen} />
        {!formOpen && <ErrorText>{error}</ErrorText>}
        <Button type="submit" full loading={busy && !formOpen && !phase} disabled={formOpen || busy}>Idagdag ang link</Button>

        {isSuperAdmin ? (
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <p className="text-xs font-bold tracking-wide text-gray-600">O MAG-UPLOAD NG VIDEO FILE (SUPER ADMIN)</p>
            <input ref={fileInput} type="file" accept="video/*" hidden onChange={(e) => uploadFile(e.target.files?.[0])} />
            <Button type="button" variant="outline" full disabled={busy || formOpen} onClick={() => fileInput.current?.click()}>
              <Upload className="h-4 w-4" aria-hidden /> Pumili ng video sa phone
            </Button>
            {phase && (
              <div className="space-y-1">
                <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.max(3, phase.pct)}%` }} />
                </div>
                <p className="text-center text-xs text-gray-600">{phase.label}... {phase.pct}%</p>
              </div>
            )}
            <p className="rounded-xl bg-gold-light px-3 py-2 text-xs text-yellow-900">
              Ang pamagat sa itaas ang gagamitin. Hanggang {MAX_VIDEO_SECONDS / 60} minuto. Ang malalaking video ay kino-compress sa phone mo (mga 640 px) para magkasya, kaya matagal ito at kailangang nakabukas ang page. Mas maganda ang maiikli (10–60 segundo).
            </p>
          </div>
        ) : (
          <p className="border-t border-gray-100 pt-3 text-xs text-gray-600">Ang pag-upload ng mismong video file ay para sa Super Admin lang. Ang admin ay maaaring maglagay ng link.</p>
        )}
      </form>

      {loading ? (
        <Spinner />
      ) : videos.length === 0 ? (
        <EmptyState icon={<Clapperboard />} title="Wala pang video">Magdagdag sa itaas.</EmptyState>
      ) : (
        <div className="space-y-2">
          {videos.map((v, i) => (
            <Card key={v.id} className={`flex items-center gap-3 !p-2.5 ${v.hidden ? "opacity-60" : ""}`}>
              <span className="block h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-brand to-brand-deep">
                {v.kind === "upload" && v.thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumb} alt="" className="h-full w-full object-cover" />
                )}
                {v.kind === "youtube" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={youtubeThumb(v.videoId)} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-bold leading-tight">{v.title}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                  <span className="rounded bg-gray-100 px-1.5 font-semibold">{KIND_LABEL[v.kind]}</span>
                  {v.hidden && <span className="rounded bg-amber-100 px-1.5 font-semibold text-amber-800">Nakatago</span>}
                  {v.kind === "upload" && v.size ? <span>{(v.size / 1048576).toFixed(1)} MB</span> : null}
                  <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" aria-hidden /> {(v.views ?? 0).toLocaleString("en-PH")}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <div className="flex gap-1">
                  {i > 0 && (
                    <button type="button" onClick={() => moveFirst(v)} aria-label="Ilagay sa una" className="rounded-lg bg-gray-100 p-2 text-gray-700 active:bg-gray-200"><ArrowUpToLine className="h-4 w-4" /></button>
                  )}
                  <button type="button" onClick={() => toggleHidden(v)} aria-label={v.hidden ? "Ipakita sa Home" : "Itago sa Home"} className={`rounded-lg p-2 active:bg-gray-200 ${v.hidden ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}`}>
                    {v.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button type="button" onClick={() => startEdit(v)} aria-label="I-edit" className="rounded-lg bg-gray-100 p-2 text-gray-700 active:bg-gray-200"><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => remove(v)} aria-label="Burahin" className="rounded-lg bg-red-50 p-2 text-red-600 active:bg-red-100"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {!formOpen && !loading && error && videos.length > 0 && <ErrorText>{error}</ErrorText>}

      <Modal open={formOpen} onClose={() => setEditing(null)} title="I-edit ang video">
        <form onSubmit={submit} className="space-y-3">
          <Input label="Pamagat" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
          {editing?.kind !== "upload" && <Input label="Link ng video" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" />}
          <ErrorText>{error}</ErrorText>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Kanselahin</Button>
            <Button type="submit" loading={busy}>I-save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
