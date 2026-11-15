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
  /** Pages (paths without the trailing slash) that show this guide's button. Admin guides have none: the Admin page asks for them by id. */
  routes: string[];
  /** For the Barangay staff only (shown in the Admin page and, in the guide list, only to staff). */
  staff?: boolean;
  group: string;
  title: { tl: string; en: string };
  steps: GuideStep[];
}

export const GUIDES: Guide[] = data.guides as Guide[];

/** One guide by its id (used by the Admin page, where one address holds many sections). */
export const guideById = (id: string): Guide | undefined => GUIDES.find((g) => g.id === id);

const clean = (path: string): string => (path.replace(/\/+$/, "") || "/");

/** The guide for the page the resident is on (undefined when that page has none). */
export function guideFor(pathname: string): Guide | undefined {
  const p = clean(pathname);
  return GUIDES.find((g) => g.routes.includes(p));
}

/** Guides grouped for the "Mga gabay" list, in the order they appear in the data. Staff guides only when `staff` is true. */
export function guideGroups(staff = false): { group: string; guides: Guide[] }[] {
  const out: { group: string; guides: Guide[] }[] = [];
  for (const g of GUIDES) {
    if (g.staff && !staff) continue;
    const slot = out.find((o) => o.group === g.group);
    if (slot) slot.guides.push(g);
    else out.push({ group: g.group, guides: [g] });
  }
  return out;
}
