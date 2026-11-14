import { EN, EN_PATTERNS } from "@/lib/en";

/**
 * English view of the site. Every screen is written in Tagalog; this swaps text that has an entry in the English
 * dictionary (src/lib/en.ts) for its English version, and swaps it back when the person returns to Tagalog.
 * Text with no entry stays in Tagalog, so the site never shows a blank or broken label while translations grow.
 * It works on text nodes and on placeholder / aria-label / title / alt, and follows new content as the page changes.
 */
interface Rec {
  src: string;
  out: string;
}

const ATTRS = ["placeholder", "aria-label", "title", "alt"] as const;
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT"]);
const textRec = new WeakMap<Text, Rec>();
const attrRec = new WeakMap<Element, Map<string, Rec>>();

let lang: "fil" | "en" = "fil";
let observer: MutationObserver | null = null;

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** English text for a Tagalog string, or null when there is none. */
export function lookup(s: string): string | null {
  const n = norm(s);
  if (!n) return null;
  const hit = EN[n];
  if (hit !== undefined) return hit;
  for (const [re, rep] of EN_PATTERNS) {
    if (re.test(n)) return n.replace(re, rep);
  }
  return null;
}

/** Translate a string from code (confirm dialogs, notifications). Tagalog is returned as is. */
export function tr(s: string): string {
  return lang === "en" ? lookup(s) ?? s : s;
}

function doText(node: Text): void {
  const rec = textRec.get(node);
  const value = node.nodeValue ?? "";
  // If the text is still what we wrote, the Tagalog source is the one we remembered; otherwise React changed it.
  const src = rec && value === rec.out ? rec.src : value;
  if (lang === "en") {
    const t = lookup(src);
    if (t !== null) {
      const lead = /^\s*/.exec(src)?.[0] ?? "";
      const trail = /\s*$/.exec(src)?.[0] ?? "";
      const out = lead + t + trail;
      if (node.nodeValue !== out) node.nodeValue = out;
      textRec.set(node, { src, out });
    } else {
      textRec.delete(node);
    }
  } else if (rec && value === rec.out) {
    node.nodeValue = rec.src;
    textRec.delete(node);
  }
}

function doAttr(el: Element, name: string): void {
  const map = attrRec.get(el) ?? new Map<string, Rec>();
  const rec = map.get(name);
  const value = el.getAttribute(name);
  if (value === null) return;
  const src = rec && value === rec.out ? rec.src : value;
  if (lang === "en") {
    const t = lookup(src);
    if (t !== null) {
      if (value !== t) el.setAttribute(name, t);
      map.set(name, { src, out: t });
      attrRec.set(el, map);
    } else {
      map.delete(name);
    }
  } else if (rec && value === rec.out) {
    el.setAttribute(name, rec.src);
    map.delete(name);
  }
}

function walk(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    doText(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  const el = root as Element;
  if (el.nodeType === Node.ELEMENT_NODE && SKIP.has(el.tagName)) return;
  const tree = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n.nodeType === Node.ELEMENT_NODE && SKIP.has((n as Element).tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let n: Node | null = root.nodeType === Node.ELEMENT_NODE ? root : tree.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) doText(n as Text);
    else if (n.nodeType === Node.ELEMENT_NODE) ATTRS.forEach((a) => (n as Element).hasAttribute(a) && doAttr(n as Element, a));
    n = tree.nextNode();
  }
}

let titleSrc: string | null = null;
function doTitle(): void {
  if (lang === "en") {
    if (titleSrc === null) titleSrc = document.title;
    const t = lookup(titleSrc);
    if (t !== null) document.title = t;
  } else if (titleSrc !== null) {
    document.title = titleSrc;
    titleSrc = null;
  }
}

function onMutations(records: MutationRecord[]): void {
  if (!observer) return;
  observer.disconnect(); // our own edits must not trigger more work
  for (const r of records) {
    if (r.type === "childList") r.addedNodes.forEach((n) => walk(n));
    else if (r.type === "characterData") doText(r.target as Text);
    else if (r.type === "attributes" && r.attributeName) doAttr(r.target as Element, r.attributeName);
  }
  doTitleOnce();
  observe();
}

let titleTimer: number | undefined;
function doTitleOnce(): void {
  window.clearTimeout(titleTimer);
  titleTimer = window.setTimeout(() => {
    // The page title changes with the route; remember the new Tagalog one.
    if (lang === "en" && titleSrc !== null && document.title !== (lookup(titleSrc) ?? titleSrc)) titleSrc = document.title;
    doTitle();
  }, 50);
}

function observe(): void {
  observer?.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
}

/** Switch the page to `next` and keep it in that language as content changes. */
export function applyLanguage(next: "fil" | "en"): void {
  lang = next;
  if (typeof document === "undefined") return;
  observer?.disconnect();
  if (!observer) observer = new MutationObserver(onMutations);
  walk(document.body);
  doTitle();
  observe();
}
