import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";
import { USE_FIREBASE_STORAGE } from "@/config/firebase.config";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // raw file limit before compression

/**
 * Resize + compress an image in the browser using canvas.
 * Phones take 4-12MB photos; this brings them down to ~100-300KB.
 */
/**
 * Resize + compress. With square=true the image is center-cropped to a square first
 * (for round avatars and logos, so they fill the circle).
 */
async function compressImage(file: File, maxSize: number, quality: number, type: "image/jpeg" | "image/png" = "image/jpeg", square = false): Promise<Blob> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Hindi mabasa ang larawan."));
      image.src = bitmapUrl;
    });

    // Source rectangle: whole image, or the centered square.
    const side = Math.min(img.width, img.height);
    const sx = square ? (img.width - side) / 2 : 0;
    const sy = square ? (img.height - side) / 2 : 0;
    const sw = square ? side : img.width;
    const sh = square ? side : img.height;

    const scale = Math.min(1, maxSize / Math.max(sw, sh));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Hindi suportado ng browser ang pag-compress ng larawan.");
    // JPEG has no transparency: paint white first so transparent PNGs don't turn black.
    if (type === "image/jpeg") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Pumalya ang pag-compress."))), type, quality),
    );
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Hindi mabasa ang larawan."));
    reader.readAsDataURL(blob);
  });
}

/** How a picture is placed in the square: "auto" decides by its shape, "fill" crops to the square, "fit" shows all of it. */
export type SquareMode = "auto" | "fill" | "fit";

/**
 * A square JPEG that looks good in a round badge or a tile.
 * - "fill": the picture covers the whole square (cropped in the middle; for a portrait photo the crop leans toward the top, where the face is).
 * - "fit": the whole picture is shown on a white square (a wide logo is not cut).
 * - "auto": photos (tall, or about square) fill the square; wide pictures (logos) fit.
 */
export async function compressToSquare(file: File, size = 200, mode: SquareMode = "auto", quality = 0.85, maxChars = 45_000): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Larawan lang ang pwedeng i-upload.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Masyadong malaki ang larawan (max 10MB).");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Hindi mabasa ang larawan."));
      i.src = url;
    });
    const ratio = img.width / img.height;
    const fill = mode === "fill" || (mode === "auto" && ratio <= 1.25);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Hindi suportado ng browser ang pag-compress ng larawan.");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = "high";
    if (fill) {
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = img.height > img.width ? (img.height - side) * 0.25 : (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    } else {
      const scale = Math.min(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    }
    let out = canvas.toDataURL("image/jpeg", quality);
    if (out.length > maxChars) out = canvas.toDataURL("image/jpeg", 0.6);
    if (out.length > maxChars) throw new Error("Masyadong malaki pa rin ang larawan. Pumili ng iba.");
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Photos of one Board post (1 to 4), each a small JPEG data URL. A Firestore document holds at most 1 MB, so the more photos
 * there are the smaller each one is made (1 photo about 1000 px, 4 photos about 720 px each).
 */
export async function compressPostPhotos(files: File[]): Promise<string[]> {
  if (files.length === 0) return [];
  const n = files.length;
  const size = n === 1 ? 1000 : n === 2 ? 860 : 720;
  const quality = n === 1 ? 0.7 : 0.62;
  const out: string[] = [];
  for (const f of files) {
    if (!f.type.startsWith("image/")) throw new Error("Larawan lang ang pwedeng i-upload.");
    if (f.size > MAX_FILE_BYTES) throw new Error("Masyadong malaki ang isang larawan (max 10MB).");
    let url = await blobToDataUrl(await compressImage(f, size, quality));
    if (url.length > 210_000) url = await blobToDataUrl(await compressImage(f, Math.round(size * 0.75), 0.5));
    if (url.length > 210_000) throw new Error("Masyadong malaki pa rin ang isang larawan. Pumili ng iba.");
    out.push(url);
  }
  if (out.reduce((sum, u) => sum + u.length, 0) > 800_000) throw new Error("Masyadong malalaki ang mga larawan. Bawasan ang bilang o pumili ng mas maliliit.");
  return out;
}

/** Compress an image to a small JPEG data URL (stored directly in Firestore). */
export async function compressToDataUrl(file: File, maxSize = 600, quality = 0.7, maxChars = 380_000, square = false): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Larawan lang ang pwedeng i-upload.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Masyadong malaki ang larawan (max 10MB).");
  const dataUrl = await blobToDataUrl(await compressImage(file, maxSize, quality, "image/jpeg", square));
  if (dataUrl.length > maxChars) throw new Error("Masyadong malaki pa rin ang larawan. Pumili ng iba.");
  return dataUrl;
}

/**
 * Logo: keeps transparency (PNG). Falls back to JPEG on white if the PNG is too big
 * for the settings document (Firestore docs are capped at 1MB in total).
 */
export async function compressLogo(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Larawan lang ang pwedeng i-upload.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Masyadong malaki ang larawan (max 10MB).");
  const png = await blobToDataUrl(await compressImage(file, 256, 1, "image/png", true));
  if (png.length <= 200_000) return png;
  const jpg = await blobToDataUrl(await compressImage(file, 256, 0.85, "image/jpeg", true));
  if (jpg.length > 200_000) throw new Error("Masyadong malaki ang logo. Pumili ng mas simpleng larawan.");
  return jpg;
}

/**
 * Upload a photo and return a URL to save in Firestore (photoURL).
 * 1) Tries Firebase Storage (uploads/{uid}/...).
 * 2) Falls back to a small compressed data URL saved directly in Firestore
 *    (useful if Storage is not enabled on the project).
 */
export async function uploadImage(file: File, uid: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Larawan lang ang pwedeng i-upload.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Masyadong malaki ang larawan (max 10MB).");

  if (USE_FIREBASE_STORAGE) {
    try {
      const blob = await compressImage(file, 1280, 0.8);
      const path = `uploads/${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
      return await getDownloadURL(storageRef);
    } catch (err) {
      console.warn("[upload] Storage failed, using Firestore fallback:", err);
    }
  }

  // Firestore fallback: keep it small (Firestore doc limit is 1MB).
  const small = await compressImage(file, 800, 0.6);
  const dataUrl = await blobToDataUrl(small);
  if (dataUrl.length > 850_000) throw new Error("Masyadong malaki pa rin ang larawan. Pumili ng iba.");
  return dataUrl;
}
