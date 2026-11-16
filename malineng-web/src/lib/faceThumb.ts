/**
 * A tiny square copy of a selfie (about 96 px, a few KB) kept on users/{uid}.faceThumb, so lists of members can show
 * real faces without reading the big selfie of every person. The full selfie stays private in verifications/{uid}.
 */
const SIZE = 96;

export async function makeFaceThumb(dataUrl: string): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Hindi mabasa ang larawan."));
    image.src = dataUrl;
  });
  // Centered square; on a portrait photo the crop leans toward the top, where the face usually is.
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = img.height > img.width ? (img.height - side) * 0.25 : 0;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Hindi suportado ng browser ang pag-compress ng larawan.");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
  return canvas.toDataURL("image/jpeg", 0.7);
}
