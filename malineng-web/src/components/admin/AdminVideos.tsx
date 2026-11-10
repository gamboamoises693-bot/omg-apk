"use client";

import { useMemo, useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ArrowUpToLine, Clapperboard, Eye, Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { logActivity } from "@/lib/activity";
import { friendlyError } from "@/lib/format";
import { useCollection } from "@/lib/useCollection";
import { VIDEO_HELP, parseVideoUrl, youtubeThumb, type Video } from "@/lib/videos";
import { Button, Card, EmptyState, ErrorText, Input, Modal, Spinner } from "@/components/ui";

const videosRef = collection(db, "videos");
const KIND_LABEL = { youtube: "YouTube", facebook: "Facebook", file: "MP4" } as const;

/** Admin: add, rename, reorder and remove the videos shown on Home. */
export function AdminVideos() {
  const { data, loading } = useCollection<Video>(videosRef);
  const videos = useMemo(() => [...data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [data]);
  const [editing, setEditing] = useState<Video | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  async function moveFirst(v: Video) {
    try {
      const min = Math.min(...videos.map((x) => x.order ?? 0));
      await updateDoc(doc(db, "videos", v.id), { order: min - 1 });
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function remove(v: Video) {
    if (!window.confirm(`Burahin ang "${v.title}"?`)) return;
    try {
      await deleteDoc(doc(db, "videos", v.id));
      logActivity("Videos", `Binura ang video: ${v.title}`, v.id);
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  const formOpen = editing !== null;
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Dito ilagay ang lahat ng video na lalabas sa Home. Walang upload: i-paste lang ang link ({VIDEO_HELP}). Ang pinakauna sa listahan ang unang lalabas.</p>

      <form onSubmit={formOpen ? (ev) => ev.preventDefault() : submit} className="space-y-3 rounded-2xl bg-white p-4 shadow-card">
        <p className="text-xs font-bold tracking-wide text-gray-600">BAGONG VIDEO</p>
        <Input label="Pamagat" value={formOpen ? "" : title} onChange={(e) => setTitle(e.target.value)} placeholder="hal. Paano mag-request ng Clearance" maxLength={100} disabled={formOpen} />
        <Input label="Link ng video" value={formOpen ? "" : url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtu.be/..." inputMode="url" disabled={formOpen} />
        {!formOpen && <ErrorText>{error}</ErrorText>}
        <Button type="submit" full loading={busy && !formOpen} disabled={formOpen}>Idagdag ang video</Button>
      </form>

      {loading ? (
        <Spinner />
      ) : videos.length === 0 ? (
        <EmptyState icon={<Clapperboard />} title="Wala pang video">Magdagdag sa itaas.</EmptyState>
      ) : (
        <div className="space-y-2">
          {videos.map((v, i) => (
            <Card key={v.id} className="flex items-center gap-3 !p-2.5">
              <span className="block h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-brand to-brand-deep">
                {v.kind === "youtube" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={youtubeThumb(v.videoId)} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-bold leading-tight">{v.title}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                  <span className="rounded bg-gray-100 px-1.5 font-semibold">{KIND_LABEL[v.kind]}</span>
                  <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" aria-hidden /> {(v.views ?? 0).toLocaleString("en-PH")}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <div className="flex gap-1">
                  {i > 0 && (
                    <button type="button" onClick={() => moveFirst(v)} aria-label="Ilagay sa una" className="rounded-lg bg-gray-100 p-2 text-gray-700 active:bg-gray-200"><ArrowUpToLine className="h-4 w-4" /></button>
                  )}
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
          <Input label="Link ng video" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" />
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
