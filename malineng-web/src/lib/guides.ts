import data from "@/data/guides.json";

/** One step of a how-to guide: a screenshot taken from the real app (with the red circle on what to press) and a short instruction. */
export interface GuideStep {
  tl: string;
  en: string;
  /** File name inside /guides/ (made by scripts/guides). */
  img: string;
  /** Pixel size of the image, so the layout does not jump while it loads. */
  w: number;
  h: number;
}

export interface Guide {
  id: string;
  /** Pages (paths without the trailing slash) that show this guide's button. */
  routes: string[];
  group: string;
  title: { tl: string; en: string };
  steps: GuideStep[];
}

export const GUIDES: Guide[] = data.guides as Guide[];

const clean = (path: string): string => (path.replace(/\/+$/, "") || "/");

/** The guide for the page the resident is on (undefined when that page has none). */
export function guideFor(pathname: string): Guide | undefined {
  const p = clean(pathname);
  return GUIDES.find((g) => g.routes.includes(p));
}

/** Guides grouped for the "Mga gabay" list, in the order they appear in the data. */
export function guideGroups(): { group: string; guides: Guide[] }[] {
  const out: { group: string; guides: Guide[] }[] = [];
  for (const g of GUIDES) {
    const slot = out.find((o) => o.group === g.group);
    if (slot) slot.guides.push(g);
    else out.push({ group: g.group, guides: [g] });
  }
  return out;
}
