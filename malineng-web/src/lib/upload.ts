import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";
import { USE_FIREBASE_STORAGE } from "@/config/firebase.config";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // raw file limit before compression

/**
 * Resize + compress an image in the browser using canvas.
 * Phones take 4-12MB photos; this brings them down to ~100-300KB.
 */
async function compressImage(file: File, maxSize: number, quality: number, type: "image/jpeg" | "image/png" = "image/jpeg"): Promise<Blob> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Hindi mabasa ang larawan."));
      image.src = bitmapUrl;
    });

    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Hindi suportado ng browser ang pag-compress ng larawan.");
    // JPEG has no transparency: paint white first so transparent PNGs don't turn black.
    if (type === "image/jpeg") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

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

/** Compress an image to a small JPEG data URL (stored directly in Firestore). */
export async function compressToDataUrl(file: File, maxSize = 600, quality = 0.7, maxChars = 380_000): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Larawan lang ang pwedeng i-upload.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Masyadong malaki ang larawan (max 10MB).");
  const dataUrl = await blobToDataUrl(await compressImage(file, maxSize, quality));
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
  const png = await blobToDataUrl(await compressImage(file, 256, 1, "image/png"));
  if (png.length <= 200_000) return png;
  const jpg = await blobToDataUrl(await compressImage(file, 256, 0.85));
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
