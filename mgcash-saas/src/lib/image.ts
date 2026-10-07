/**
 * Compress a camera photo into a small JPEG data URL so it fits in a Firestore doc
 * (rules cap it at 600 KB). Keeps the app on the free Spark plan - no Cloud Storage needed.
 */
export async function compressImage(file: File, maxSide = 720, quality = 0.6): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Hindi image ang file.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // Stamp time on the photo so old photos can't be reused as proof.
  const stamp = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  ctx.font = `${Math.max(14, Math.round(canvas.width / 30))}px sans-serif`;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, canvas.height - 32, canvas.width, 32);
  ctx.fillStyle = "#FFC107";
  ctx.fillText(stamp, 8, canvas.height - 10);

  let q = quality;
  let url = canvas.toDataURL("image/jpeg", q);
  while (url.length > 550_000 && q > 0.2) {
    q -= 0.1;
    url = canvas.toDataURL("image/jpeg", q);
  }
  return url;
}
