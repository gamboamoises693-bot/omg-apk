/**
 * Photo for the Barangay ID, made on the phone itself (nothing is uploaded to any service):
 *  - "white":  the person is cut out with MediaPipe Selfie Segmentation and put on a white background.
 *  - "office": the same, and the clothes below the neck are replaced by a drawn blazer / barong / polo template.
 * The original selfie is never changed; this result is kept next to it and needs the Kapitan's or Secretary's approval.
 */
export type Look = "original" | "white" | "office";
export type Attire = "blazer-tie" | "barong" | "blazer" | "polo";

export const ATTIRE_LABEL: Record<Attire, string> = {
  "blazer-tie": "Blazer at necktie",
  barong: "Barong Tagalog",
  blazer: "Blazer (walang tie)",
  polo: "Puting polo",
};
export const BLAZER_COLORS = ["#14306b", "#1f2937", "#6b7280"] as const;

/** Output size: 4:5, the same shape as the photo on the ID. */
export const PHOTO_W = 480;
export const PHOTO_H = 600;

/* ---------------- Segmentation (MediaPipe, files in /mediapipe) ---------------- */

interface SegResults {
  segmentationMask: CanvasImageSource;
}
interface Segmenter {
  setOptions(o: { modelSelection: number }): void;
  onResults(cb: (r: SegResults) => void): void;
  send(i: { image: CanvasImageSource }): Promise<void>;
  initialize(): Promise<void>;
}
declare global {
  interface Window {
    SelfieSegmentation?: new (c: { locateFile: (f: string) => string }) => Segmenter;
  }
}

let segmenterPromise: Promise<Segmenter> | null = null;
let pending: ((r: SegResults) => void) | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.SelfieSegmentation) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("script"));
    document.head.appendChild(s);
  });
}

function getSegmenter(): Promise<Segmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      await loadScript("/mediapipe/selfie_segmentation.js");
      const Ctor = window.SelfieSegmentation;
      if (!Ctor) throw new Error("segmenter");
      const seg = new Ctor({ locateFile: (f) => `/mediapipe/${f}` });
      seg.setOptions({ modelSelection: 0 });
      seg.onResults((r) => pending?.(r));
      await seg.initialize();
      return seg;
    })().catch((e) => {
      segmenterPromise = null;
      throw e;
    });
  }
  return segmenterPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

/** The selfie cropped (cover) to PHOTO_W x PHOTO_H. */
function coverCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = PHOTO_W;
  c.height = PHOTO_H;
  const ctx = c.getContext("2d")!;
  const scale = Math.max(PHOTO_W / img.width, PHOTO_H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (PHOTO_W - w) / 2, (PHOTO_H - h) / 2, w, h);
  return c;
}

export interface Cutout {
  /** The selfie at photo size. */
  base: HTMLCanvasElement;
  /** Person probability per pixel, 0 to 255. */
  mask: Uint8ClampedArray;
}

const cutouts = new Map<string, Promise<Cutout>>();

/** Finds the person in the selfie (remembered per selfie, so changing the look is instant). */
export function cutOut(selfie: string): Promise<Cutout> {
  let hit = cutouts.get(selfie);
  if (!hit) {
    hit = (async () => {
      const img = await loadImage(selfie);
      const base = coverCanvas(img);
      const seg = await getSegmenter();
      const result = await new Promise<SegResults>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), 20000);
        pending = (r) => {
          clearTimeout(timer);
          resolve(r);
        };
        seg.send({ image: base }).catch(reject);
      });
      const m = document.createElement("canvas");
      m.width = PHOTO_W;
      m.height = PHOTO_H;
      const mctx = m.getContext("2d")!;
      mctx.drawImage(result.segmentationMask, 0, 0, PHOTO_W, PHOTO_H);
      const px = mctx.getImageData(0, 0, PHOTO_W, PHOTO_H).data;
      // The mask carries the probability in the red channel.
      const mask = new Uint8ClampedArray(PHOTO_W * PHOTO_H);
      for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4];
      return { base, mask };
    })();
    cutouts.set(selfie, hit);
    hit.catch(() => cutouts.delete(selfie));
  }
  return hit;
}

/* ---------------- Measuring the person ---------------- */

export interface Body {
  top: number;
  headWidth: number;
  /** Row where the shoulders start. */
  shoulderRow: number;
  shoulderWidth: number;
  /** Estimated row of the chin. */
  chinRow: number;
  /** Row where the neckline of the new clothes starts (a little under the chin). */
  neckLine: number;
  /** Horizontal centre of the neck. */
  cx: number;
}

const solid = (v: number) => v > 128;

/** Reads the head and shoulder positions from the person mask. */
export function measure(mask: Uint8ClampedArray): Body | null {
  const widths: number[] = new Array(PHOTO_H).fill(0);
  const sumX: number[] = new Array(PHOTO_H).fill(0);
  for (let y = 0; y < PHOTO_H; y++) {
    for (let x = 0; x < PHOTO_W; x++) {
      if (solid(mask[y * PHOTO_W + x])) {
        widths[y] += 1;
        sumX[y] += x;
      }
    }
  }
  const top = widths.findIndex((w) => w > PHOTO_W * 0.04);
  if (top < 0) return null;
  const extent = PHOTO_H - top;
  const headRows = widths.slice(top + Math.round(extent * 0.08), top + Math.round(extent * 0.34)).sort((a, b) => a - b);
  if (headRows.length === 0) return null;
  const headWidth = headRows[Math.floor(headRows.length * 0.9)] || headRows[headRows.length - 1];
  let shoulderRow = -1;
  for (let y = top + Math.round(extent * 0.3); y < PHOTO_H; y++) {
    if (widths[y] > headWidth * 1.6) {
      shoulderRow = y;
      break;
    }
  }
  if (shoulderRow < 0) shoulderRow = top + Math.round(extent * 0.58);
  const shoulderWidth = widths[Math.min(PHOTO_H - 1, shoulderRow + 40)] || headWidth * 2.4;
  // Neck centre: the middle of the person just above the shoulders.
  let n = 0;
  let sx = 0;
  for (let y = Math.max(top, shoulderRow - 50); y < shoulderRow - 6; y++) {
    n += widths[y];
    sx += sumX[y];
  }
  const cx = n > 0 ? sx / n : PHOTO_W / 2;
  // A face, neck and shoulders keep about the same proportions: the chin sits roughly a fifth of the height above the shoulders.
  const chinRow = Math.round(shoulderRow - 0.19 * (shoulderRow - top));
  const neckLine = Math.round(shoulderRow - 0.12 * (shoulderRow - top));
  return { top, headWidth, shoulderRow, shoulderWidth, chinRow, neckLine, cx };
}

/* ---------------- Drawing ---------------- */

const shade = (hex: string, amt: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
};

/** SVG of the clothes. The neck is at x = 150 and the neckline starts at y = 10. */
export function attireSvg(attire: Attire, blazer: string): string {
  // The V of the neckline is left open: the neck of the person shows through it.
  const torso = "M0 300 L0 70 C0 40 40 25 105 10 L150 66 L195 10 C260 25 300 40 300 70 L300 300 Z";
  const parts: string[] = [];
  if (attire === "barong") {
    parts.push(`<path d="${torso}" fill="#efe4c6"/>`);
    parts.push(`<path d="M105 10 L150 62 L132 66 L96 22Z" fill="#f7efd9" stroke="#d8c9a0" stroke-width="2"/><path d="M195 10 L150 62 L168 66 L204 22Z" fill="#f7efd9" stroke="#d8c9a0" stroke-width="2"/>`);
    parts.push(`<path d="M150 62 V300" stroke="#c9b98c" stroke-width="3"/><path d="M118 90 V300 M182 90 V300" stroke="#d9cba3" stroke-width="2" opacity=".7"/>`);
    parts.push(`<path d="M20 120 V300 M280 120 V300" stroke="#e0d2aa" stroke-width="2" opacity=".6"/>`);
  } else if (attire === "polo") {
    parts.push(`<path d="${torso}" fill="#f5f7fb"/>`);
    parts.push(`<path d="M0 300 L0 70 C0 40 40 25 105 10 L150 66 L195 10 C260 25 300 40 300 70 L300 300 L260 300 L250 80 C230 50 200 30 150 90 C100 30 70 50 50 80 L40 300Z" fill="#e3e8f2" opacity=".5"/>`);
    parts.push(`<path d="M104 8 L150 66 L128 70 L88 24Z" fill="#ffffff" stroke="#cfd7e6" stroke-width="2"/><path d="M196 8 L150 66 L172 70 L212 24Z" fill="#ffffff" stroke="#cfd7e6" stroke-width="2"/>`);
    parts.push(`<path d="M150 66 V130" stroke="#cfd7e6" stroke-width="3"/><circle cx="150" cy="86" r="3.5" fill="#cfd7e6"/><circle cx="150" cy="110" r="3.5" fill="#cfd7e6"/>`);
  } else {
    // Blazer, with or without a tie.
    parts.push(`<path d="${torso}" fill="${blazer}"/>`);
    parts.push(`<path d="M105 10 L150 66 L195 10 L205 20 L150 100 L95 20Z" fill="#ffffff"/>`);
    parts.push(`<path d="M105 10 L150 62 L128 66 L96 22Z" fill="#f4f6fa" stroke="#d3dae8" stroke-width="2"/><path d="M195 10 L150 62 L172 66 L204 22Z" fill="#f4f6fa" stroke="#d3dae8" stroke-width="2"/>`);
    parts.push(`<path d="M92 18 L150 105 L118 170 L50 70Z" fill="${shade(blazer, 14)}"/><path d="M208 18 L150 105 L182 170 L250 70Z" fill="${shade(blazer, 14)}"/>`);
    parts.push(`<path d="M92 18 L150 105 L118 170" stroke="${shade(blazer, -28)}" stroke-width="3" fill="none"/><path d="M208 18 L150 105 L182 170" stroke="${shade(blazer, -28)}" stroke-width="3" fill="none"/>`);
    if (attire === "blazer-tie") {
      parts.push(`<path d="M141 54 L159 54 L156 70 L144 70Z" fill="#1d2b4a"/><path d="M144 70 L156 70 L164 200 L150 222 L136 200Z" fill="#1d2b4a"/><path d="M146 80 L150 200" stroke="#31466f" stroke-width="2" opacity=".6"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">${parts.join("")}</svg>`;
}

const svgImage = (svg: string) => loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

/** The person on white; for "office" also in the chosen clothes. Returns a JPEG data URL (about 40 KB). */
export async function makeIdPhoto(selfie: string, look: Exclude<Look, "original">, attire: Attire = "blazer-tie", blazer: string = BLAZER_COLORS[0]): Promise<string> {
  const { base, mask } = await cutOut(selfie);

  // Person only (soft edge) on a transparent layer.
  const person = document.createElement("canvas");
  person.width = PHOTO_W;
  person.height = PHOTO_H;
  const pctx = person.getContext("2d")!;
  pctx.drawImage(base, 0, 0);
  const pix = pctx.getImageData(0, 0, PHOTO_W, PHOTO_H);
  const orig = new Uint8ClampedArray(pix.data);
  const body = look === "office" ? measure(mask) : null;
  // Below the chin only a neck-wide column stays; the new clothes are drawn over everything under the neckline.
  const neckLine = body ? body.neckLine : PHOTO_H + 1;
  const neckHalf = body ? body.headWidth * 0.3 : 0;
  for (let y = 0; y < PHOTO_H; y++) {
    for (let x = 0; x < PHOTO_W; x++) {
      const i = y * PHOTO_W + x;
      const p = mask[i] / 255;
      // Soft edge: below 0.45 nothing, above 0.75 everything.
      let a = Math.max(0, Math.min(1, (p - 0.45) / 0.3));
      if (body && y > body.chinRow && Math.abs(x - body.cx) > neckHalf) a = 0;
      if (body && y > neckLine + 10) a = 0;
      pix.data[i * 4 + 3] = Math.round(a * 255);
    }
  }
  if (body) {
    // The neck goes on a little under the neckline (colours of the rows just above it, smoothed and slightly darker), so the V of the new collar shows skin.
    const x0 = Math.max(0, Math.round(body.cx - neckHalf));
    const x1 = Math.min(PHOTO_W - 1, Math.round(body.cx + neckHalf));
    const avg: [number, number, number][] = [];
    for (let x = x0; x <= x1; x++) {
      let r = 0, g = 0, b2 = 0, n = 0;
      for (let y = Math.max(0, neckLine - 14); y <= neckLine - 2; y++) {
        const j = (y * PHOTO_W + x) * 4;
        r += orig[j]; g += orig[j + 1]; b2 += orig[j + 2]; n += 1;
      }
      avg.push([r / n, g / n, b2 / n]);
    }
    // Smooth sideways, so no streaks show.
    const smooth = avg.map((_, k) => {
      let r = 0, g = 0, b2 = 0, n = 0;
      for (let d = -14; d <= 14; d++) {
        const c = avg[Math.max(0, Math.min(avg.length - 1, k + d))];
        r += c[0]; g += c[1]; b2 += c[2]; n += 1;
      }
      return [r / n, g / n, b2 / n];
    });
    for (let y = neckLine + 1; y < Math.min(PHOTO_H, neckLine + 90); y++) {
      const dark = 1 - ((y - neckLine) / 90) * 0.18;
      for (let x = x0; x <= x1; x++) {
        const i = (y * PHOTO_W + x) * 4;
        const c = smooth[x - x0];
        pix.data[i] = c[0] * dark;
        pix.data[i + 1] = c[1] * dark;
        pix.data[i + 2] = c[2] * dark;
        pix.data[i + 3] = 255;
      }
    }
  }
  pctx.putImageData(pix, 0, 0);

  const out = document.createElement("canvas");
  out.width = PHOTO_W;
  out.height = PHOTO_H;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PHOTO_W, PHOTO_H);

  ctx.drawImage(person, 0, 0);
  if (look === "office" && body) {
    // The new clothes go over the person, from the neckline down; the V of the neckline shows the neck.
    const img = await svgImage(attireSvg(attire, blazer));
    const width = Math.max(body.headWidth * 2.0, Math.min(PHOTO_W * 1.02, body.shoulderWidth * 0.98));
    const scale = width / 300;
    const left = body.cx - 150 * scale;
    const top = neckLine - 10 * scale;
    ctx.drawImage(img, left, top, 300 * scale, 300 * scale);
    // Extend the clothes to the bottom edge.
    ctx.fillStyle = attire === "barong" ? "#efe4c6" : attire === "polo" ? "#f5f7fb" : blazer;
    ctx.fillRect(Math.max(0, left), top + 300 * scale - 1, Math.min(PHOTO_W, 300 * scale), PHOTO_H);
  }
  return out.toDataURL("image/jpeg", 0.82);
}
/** Small preview of an attire on the white background (for the picker). */
export async function attireThumb(attire: Attire, blazer: string): Promise<string> {
  const c = document.createElement("canvas");
  c.width = 120;
  c.height = 120;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 120, 120);
  // A simple head above the clothes.
  ctx.fillStyle = "#e0ad86";
  ctx.beginPath();
  ctx.ellipse(60, 38, 20, 25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1c1a1d";
  ctx.beginPath();
  ctx.ellipse(60, 26, 21, 15, 0, Math.PI, 0);
  ctx.fill();
  const img = await svgImage(attireSvg(attire, blazer));
  ctx.drawImage(img, 5, 52, 110, 110);
  return c.toDataURL("image/png");
}
