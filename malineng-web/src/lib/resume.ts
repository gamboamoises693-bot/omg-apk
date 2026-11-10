import { compressToDataUrl } from "./upload";

/** A PDF resume is kept as it is, so it must be small (the application document is capped at 1 MB). */
export const MAX_PDF_BYTES = 450 * 1024;

export interface ResumeFile {
  data: string;
  name: string;
  type: string;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Hindi mabasa ang file."));
    reader.readAsDataURL(file);
  });
}

/** PDF (up to 450 KB) or a photo of the resume (shrunk automatically). */
export async function readResume(file: File): Promise<ResumeFile> {
  const name = file.name.slice(0, 100);
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES) throw new Error("Masyadong malaki ang PDF (max 450 KB). Paliitin ito, o ilagay ang link ng resume mo.");
    return { data: await readAsDataUrl(file), name, type: "application/pdf" };
  }
  if (file.type.startsWith("image/")) {
    return { data: await compressToDataUrl(file, 1600, 0.8, 650_000), name, type: "image/jpeg" };
  }
  throw new Error("PDF o larawan lang ang pwede para sa resume.");
}
