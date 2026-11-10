import { Bytes, collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from "firebase/firestore";
import { db } from "./firebase";

/** Stay well under Firestore's 1 MiB document limit. */
export const CHUNK_BYTES = 700 * 1024;

/** Store a video as numbered chunk documents (free plan: no Cloud Storage). */
export async function uploadVideoChunks(videoId: string, blob: Blob, onProgress: (done: number, total: number) => void): Promise<number> {
  const total = Math.ceil(blob.size / CHUNK_BYTES);
  for (let i = 0; i < total; i++) {
    const bytes = new Uint8Array(await blob.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES).arrayBuffer());
    await setDoc(doc(db, "videos", videoId, "chunks", String(i).padStart(3, "0")), { n: i, data: Bytes.fromUint8Array(bytes) });
    onProgress(i + 1, total);
  }
  return total;
}

/** Download all chunks and join them into one playable Blob. */
export async function loadVideoBlob(videoId: string, mime: string, onProgress?: (pct: number) => void): Promise<Blob> {
  const snap = await getDocs(query(collection(db, "videos", videoId, "chunks"), orderBy("n")));
  if (snap.empty) throw new Error("Wala pang laman ang video na ito.");
  const parts: BlobPart[] = [];
  snap.docs.forEach((d, i) => {
    const data = (d.data().data as Bytes).toUint8Array();
    parts.push(data as BlobPart);
    onProgress?.(Math.round(((i + 1) / snap.size) * 100));
  });
  return new Blob(parts, { type: mime });
}

export async function deleteVideoChunks(videoId: string): Promise<void> {
  const snap = await getDocs(collection(db, "videos", videoId, "chunks"));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}
