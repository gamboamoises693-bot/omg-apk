import type { jsPDF } from "jspdf";
import type { Summary, Txn } from "./transactions";
import { STATUS_WORD } from "./transactions";
import { RAG_WORD, type AyudaData, type HealthData, type ProjectData, type Rag, type Scorecard } from "./executive";

/**
 * Executive PDF report of the barangay (A4, portrait): one page for each tab the Kapitan picks.
 * Built in the browser with jsPDF (loaded only when the button is pressed), so nothing is uploaded anywhere.
 * jsPDF's built-in fonts have no peso sign, so amounts are written with a plain "P".
 */

export type PdfTab = "buod" | "kalusugan" | "proyekto" | "ayuda" | "transaksyon";

export interface PdfInput {
  /** Tabs to print, one page each (printed in the order of the tabs). */
  tabs: PdfTab[];
  /** e.g. "7 araw" */
  periodLabel: string;
  /** e.g. "Nob 14, 2026 - Nob 20, 2026" */
  rangeText: string;
  summary: Summary;
  txns: Txn[];
  health: HealthData | null;
  projects: ProjectData | null;
  ayuda: AyudaData | null;
  scorecard: Scorecard | null;
  preparedBy: string;
  preparedRole: string;
  captainName: string;
  /** PNG data URL of the barangay seal; the report still works without it. */
  seal?: string | null;
  /** True when a source hit the read cap. */
  truncated?: boolean;
}

type RGB = [number, number, number];
const NAVY: RGB = [11, 43, 87];
const NAVY_DARK: RGB = [10, 27, 60];
const BLUE: RGB = [31, 95, 174];
const GOLD: RGB = [212, 175, 55];
const INK: RGB = [17, 24, 39];
const MUTED: RGB = [90, 100, 118];
const LINE: RGB = [227, 232, 240];
const SOFT: RGB = [244, 246, 250];
const GREEN: RGB = [4, 120, 87];
const AMBER: RGB = [133, 77, 14];
const RED: RGB = [185, 28, 28];
const RAG_COLOR: Record<Rag, RGB> = { g: GREEN, y: AMBER, r: RED, n: MUTED };
const RAG_BG: Record<Rag, RGB> = { g: [236, 253, 245], y: [254, 252, 232], r: [254, 242, 242], n: [237, 240, 245] };

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const W = PAGE_W - MARGIN * 2;

const TAB_TITLE: Record<PdfTab, string> = {
  buod: "Buod at scorecard",
  kalusugan: "Kalusugan at emergency",
  proyekto: "Proyekto at pondo",
  ayuda: "Ayuda at residente",
  transaksyon: "Mga transaksyon",
};

const peso = (n: number) => `P${Math.round(n).toLocaleString("en-PH")}`;

/** Loads the seal (webp) and returns it as a PNG data URL, or null if it cannot be loaded. */
export async function loadSealPng(url = "/seal-barangay.webp"): Promise<string | null> {
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, 200, 200);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export async function downloadDashboardPdf(input: PdfInput, filename: string): Promise<void> {
  const { jsPDF: PDF } = await import("jspdf");
  const doc: jsPDF = new PDF({ unit: "mm", format: "a4" });
  let y = 0;

  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const font = (style: "normal" | "bold" | "italic", size: number) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
  };
  /** jsPDF's built-in fonts only know Latin-1: swap thin spaces and anything else outside it. */
  const safe = (text: string): string => text.replace(/[  ]/g, " ").replace(/[–—]/g, "-").replace(/[^\x20-\xFF]/g, "?");
  const fit = (raw: string, width: number): string => {
    const text = safe(raw);
    if (doc.getTextWidth(text) <= width) return text;
    let t = text;
    while (t.length > 1 && doc.getTextWidth(`${t}...`) > width) t = t.slice(0, -1);
    return `${t}...`;
  };

  /* ---------- Page frame: flag stripe, navy band with seal, gold line ---------- */
  const frame = (title: string) => {
    fill([0, 56, 168]);
    doc.rect(0, 0, PAGE_W / 2, 3, "F");
    fill([206, 17, 38]);
    doc.rect(PAGE_W / 2, 0, PAGE_W / 2, 3, "F");
    fill(NAVY_DARK);
    doc.rect(0, 3, PAGE_W, 6, "F");
    color([255, 255, 255]);
    font("bold", 6);
    doc.text("R E P U B L I K A   N G   P I L I P I N A S", PAGE_W / 2, 7.2, { align: "center" });
    fill(NAVY);
    doc.rect(0, 9, PAGE_W, 27, "F");
    fill(GOLD);
    doc.rect(0, 36, PAGE_W, 1.1, "F");
    let x = MARGIN;
    if (input.seal) {
      try {
        doc.addImage(input.seal, "PNG", MARGIN, 11.5, 22, 22);
        x = MARGIN + 27;
      } catch {
        /* The report works without the seal. */
      }
    }
    color([255, 255, 255]);
    font("bold", 16);
    doc.text(safe(title.toUpperCase()), x, 21);
    font("normal", 9);
    doc.text("Barangay Malineng, Cuyapo, Nueva Ecija", x, 26.5);
    color([232, 215, 140]);
    font("normal", 8);
    doc.text(safe(`Ulat ng Punong Barangay  |  ${input.periodLabel}  |  ${input.rangeText}`), x, 31.5);
    y = 46;
  };

  const sectionTitle = (title: string, right = "") => {
    fill(GOLD);
    doc.rect(MARGIN, y - 3.4, 1, 4.4, "F");
    color(NAVY);
    font("bold", 10);
    doc.text(safe(title.toUpperCase()), MARGIN + 3, y);
    if (right) {
      color(MUTED);
      font("normal", 7.5);
      doc.text(safe(right), PAGE_W - MARGIN, y, { align: "right" });
    }
    y += 6;
  };

  /** Row of equal KPI cards. */
  const kpis = (list: { label: string; value: string; note?: string; tone?: RGB }[]) => {
    const gap = 3;
    const w = (W - gap * (list.length - 1)) / list.length;
    list.forEach((k, i) => {
      const x = MARGIN + i * (w + gap);
      fill([255, 255, 255]);
      stroke(LINE);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, w, 22, 2, 2, "FD");
      fill(k.tone ?? NAVY);
      doc.rect(x, y + 3.5, 1, 15, "F");
      color(MUTED);
      font("bold", 5.8);
      doc.text(fit(k.label.toUpperCase(), w - 5), x + 3.5, y + 6.5);
      color(k.tone ?? NAVY);
      font("bold", 17);
      doc.text(fit(k.value, w - 5), x + 3.5, y + 14.5);
      if (k.note) {
        color(MUTED);
        font("normal", 6);
        doc.text(fit(k.note, w - 5), x + 3.5, y + 19.5);
      }
    });
    y += 27;
  };

  /** Label, bar, number: one line of a bar chart. */
  const bar = (label: string, value: number, max: number, text: string, c: RGB = BLUE, labelW = 40) => {
    color(INK);
    font("normal", 8.6);
    doc.text(fit(label, labelW - 2), MARGIN, y + 3.2);
    const track = W - labelW - 26;
    fill(SOFT);
    doc.roundedRect(MARGIN + labelW, y, track, 4.4, 1.2, 1.2, "F");
    if (value > 0) {
      fill(c);
      doc.roundedRect(MARGIN + labelW, y, Math.max(2, (value / Math.max(1, max)) * track), 4.4, 1.2, 1.2, "F");
    }
    color(INK);
    font("bold", 8.6);
    doc.text(safe(text), PAGE_W - MARGIN, y + 3.3, { align: "right" });
    y += 6.8;
  };

  /** Two-column text row with a hairline above. */
  const textRow = (left: string, right: string, rightColor: RGB = INK) => {
    stroke(LINE);
    doc.setLineWidth(0.15);
    doc.line(MARGIN, y - 1.6, PAGE_W - MARGIN, y - 1.6);
    color(INK);
    font("normal", 8.6);
    doc.text(fit(left, W - 40), MARGIN, y + 2.4);
    color(rightColor);
    font("bold", 8.6);
    doc.text(safe(right), PAGE_W - MARGIN, y + 2.4, { align: "right" });
    y += 6.6;
  };

  const chip = (x: number, yy: number, label: string, rag: Rag) => {
    font("bold", 5.6);
    const text = safe(label.toUpperCase());
    const w = doc.getTextWidth(text) + 5;
    fill(RAG_BG[rag]);
    doc.roundedRect(x - w, yy - 2.8, w, 4.2, 2, 2, "F");
    fill(RAG_COLOR[rag]);
    doc.circle(x - w + 2, yy - 0.7, 0.7, "F");
    color(RAG_COLOR[rag]);
    doc.text(text, x - w + 3.4, yy);
  };

  const paragraph = (text: string, size = 9.5) => {
    color(INK);
    font("normal", size);
    const lines = doc.splitTextToSize(safe(text), W) as string[];
    doc.text(lines, MARGIN, y);
    y += lines.length * (size * 0.47) + 3;
  };

  const empty = (text: string) => {
    color(MUTED);
    font("italic", 8.5);
    doc.text(safe(text), MARGIN, y + 3);
    y += 9;
  };

  const s = input.summary;
  let first = true;
  const open = (tab: PdfTab) => {
    if (!first) doc.addPage();
    first = false;
    frame(TAB_TITLE[tab]);
  };

  /* ---------- Buod ---------- */
  const pageBuod = () => {
    open("buod");
    const card = input.scorecard;
    const urgent = card?.attention.filter((a) => a.tone === "r").length ?? 0;
    paragraph(`${s.total} transaksyon sa panahong ito${s.change === null ? "" : `, ${s.change >= 0 ? "tumaas" : "bumaba"} ng ${Math.abs(s.change)}% kumpara sa nakaraan`}. ${urgent > 0 ? `May ${urgent} bagay na kailangan ng iyong pansin.` : "Walang kritikal na bagay."}`, 10);
    y += 2;
    sectionTitle("Scorecard ng barangay");
    if (!card) empty("Walang datos.");
    else {
      const gap = 3;
      const w = (W - gap * 2) / 3;
      card.items.forEach((it, i) => {
        const x = MARGIN + (i % 3) * (w + gap);
        const yy = y + Math.floor(i / 3) * 31;
        fill([255, 255, 255]);
        stroke(LINE);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, yy, w, 28, 2, 2, "FD");
        color(MUTED);
        font("bold", 6);
        doc.text(it.label.toUpperCase(), x + 3, yy + 6);
        chip(x + w - 2.5, yy + 5.8, RAG_WORD[it.rag], it.rag);
        color(NAVY);
        font("bold", 19);
        doc.text(safe(it.value), x + 3, yy + 17);
        color(MUTED);
        font("normal", 6.4);
        doc.text(fit(it.note, w - 6), x + 3, yy + 23.5);
      });
      y += 66;
      sectionTitle("Dapat bigyang-pansin", `${card.attention.length}`);
      if (card.attention.length === 0) empty("Walang kailangang bigyang-pansin. Maayos ang lahat.");
      card.attention.slice(0, 7).forEach((a) => {
        stroke(LINE);
        doc.setLineWidth(0.15);
        doc.line(MARGIN, y - 1.8, PAGE_W - MARGIN, y - 1.8);
        fill(a.tone === "r" ? RED : AMBER);
        doc.circle(MARGIN + 1.5, y + 1.6, 1.1, "F");
        color(INK);
        font("bold", 8.8);
        doc.text(fit(a.title, W - 8), MARGIN + 5, y + 2.2);
        if (a.detail) {
          color(MUTED);
          font("normal", 7.4);
          doc.text(fit(a.detail, W - 8), MARGIN + 5, y + 6.2);
        }
        y += 10.4;
      });
      y += 2;
      color(MUTED);
      font("italic", 6.6);
      doc.text("Kulay: Maayos / Bantayan / Kritikal ayon sa mga patakaran sa Dashboard (Paano binibilang ang kulay?).", MARGIN, y + 1);
    }
    if (input.ayuda) {
      y += 8;
      kpis([
        { label: "Account ng residente", value: String(input.ayuda.residents.total) },
        { label: "Household", value: String(input.ayuda.residents.households) },
        { label: "Verified", value: input.ayuda.residents.total ? `${Math.round((input.ayuda.residents.verified / input.ayuda.residents.total) * 100)}%` : "0%" },
      ]);
    }
  };

  /* ---------- Kalusugan ---------- */
  const pageKalusugan = () => {
    open("kalusugan");
    const h = input.health;
    if (!h) return empty("Walang datos.");
    const a = h.ambulance;
    sectionTitle("Ambulansya at emergency");
    kpis([
      { label: "Biyahe", value: String(a.trips) },
      { label: "Karaniwang sagot", value: a.avgRespMin === null ? "-" : `${a.avgRespMin} min`, note: a.avgRespMin === null ? "Walang naka-tala" : "Request hanggang pag-alis" },
      { label: "Naghihintay", value: String(a.waiting), tone: a.waiting ? RED : NAVY },
    ]);
    const m = Math.max(1, a.emergency, a.scheduled);
    bar("Emergency", a.emergency, m, String(a.emergency), RED);
    bar("Naka-schedule", a.scheduled, m, String(a.scheduled));
    a.reasons.forEach((r) => textRow(`Dahilan: ${r.reason}`, String(r.count)));
    y += 4;

    sectionTitle("Botika");
    kpis([
      { label: "Gamot na naibigay", value: String(h.botika.given) },
      { label: "Paubos na", value: String(h.botika.low.length), tone: h.botika.low.length ? AMBER : NAVY },
      { label: "Malapit mag-expire", value: String(h.botika.expiring.length), tone: h.botika.expiring.length ? RED : NAVY },
    ]);
    h.botika.low.slice(0, 4).forEach((x) => textRow(`${x.name} (pinakamababa ${x.min})`, `${x.stock} natitira`, x.stock === 0 ? RED : AMBER));
    h.botika.expiring.slice(0, 3).forEach((x) => textRow(`${x.name} - ${x.expiry}`, x.days < 0 ? "Expired" : `${x.days} araw`, x.days < 0 ? RED : AMBER));
    y += 4;

    sectionTitle("Bakuna at buntis");
    bar("Updated ang bakuna", h.vaccine.completePct ?? 0, 100, h.vaccine.completePct === null ? "-" : `${h.vaccine.completePct}%`, GREEN, 44);
    y += 1;
    kpis([
      { label: "Sanggol na delayed", value: String(h.vaccine.childrenDelayed), tone: h.vaccine.childrenDelayed ? RED : NAVY },
      { label: "Aktibong buntis", value: String(h.pregnancy.active) },
      { label: "Check-up sa 7 araw", value: String(h.pregnancy.checkupSoon) },
    ]);

    sectionTitle("Sektor na dapat alagaan");
    textRow("Senior citizen", String(h.sectors.senior));
    textRow("PWD", String(h.sectors.pwd));
    textRow("Solo parent", String(h.sectors.solo));
  };

  /* ---------- Proyekto ---------- */
  const pageProyekto = () => {
    open("proyekto");
    const p = input.projects;
    if (!p) return empty("Walang datos.");
    sectionTitle("Mga proyekto", p.delayed ? `${p.delayed} naantala` : "");
    if (p.total === 0) empty("Wala pang proyektong naka-encode.");
    else {
      kpis([
        { label: "Lahat", value: String(p.total) },
        { label: "Ginagawa", value: String(p.ongoing), tone: BLUE },
        { label: "Tapos na", value: String(p.completed), tone: GREEN },
        { label: "Naantala", value: String(p.delayed), tone: p.delayed ? RED : NAVY },
      ]);
      let x = MARGIN;
      ([[p.ongoing, BLUE], [p.completed, GREEN], [p.delayed, RED], [p.planned, [201, 212, 229] as RGB]] as [number, RGB][]).forEach(([n, c]) => {
        const w = (n / p.total) * W;
        if (w > 0) {
          fill(c);
          doc.rect(x, y, w, 4, "F");
          x += w;
        }
      });
      y += 7;
      color(MUTED);
      font("normal", 6.6);
      doc.text("Asul: ginagawa   Berde: tapos na   Pula: naantala   Abo: nakaplano", MARGIN, y);
      y += 7;
      sectionTitle("Pinakamahalagang proyekto");
      p.top.forEach((pr) => {
        color(INK);
        font("bold", 9);
        doc.text(fit(pr.name, W - 40), MARGIN, y + 2);
        chip(PAGE_W - MARGIN, y + 2, pr.status === "delayed" ? "Naantala" : pr.status === "completed" ? "Tapos na" : pr.status === "ongoing" ? "Ginagawa" : "Nakaplano", pr.status === "delayed" ? "r" : pr.status === "completed" ? "g" : "n");
        y += 5;
        fill(SOFT);
        doc.roundedRect(MARGIN, y, W, 3.4, 1.2, 1.2, "F");
        fill(pr.status === "delayed" ? RED : pr.status === "completed" ? GREEN : BLUE);
        if (pr.progress > 0) doc.roundedRect(MARGIN, y, Math.max(2, (pr.progress / 100) * W), 3.4, 1.2, 1.2, "F");
        y += 7;
        color(MUTED);
        font("normal", 7.2);
        doc.text(safe(`${pr.progress}%  |  Badyet ${peso(pr.budget)}${pr.targetDate ? `  |  Target: ${pr.targetDate}` : ""}`), MARGIN, y);
        y += 7;
      });
    }
    y += 2;
    sectionTitle(`Pondo ng barangay ${p.year}`);
    const b = p.budget;
    if (!b || b.total <= 0) empty(`Wala pang badyet na naka-encode para sa ${p.year}.`);
    else {
      const used = Math.round((b.spent / b.total) * 100);
      kpis([
        { label: "Nagamit", value: `${used}%` },
        { label: "Nagastos", value: peso(b.spent) },
        { label: "Badyet", value: peso(b.total) },
      ]);
      const m = Math.max(1, ...p.spendByCategory.map((c) => c.amount));
      p.spendByCategory.forEach((c) => bar(c.name, c.amount, m, peso(c.amount), BLUE, 46));
    }
  };

  /* ---------- Ayuda ---------- */
  const pageAyuda = () => {
    open("ayuda");
    const a = input.ayuda;
    if (!a) return empty("Walang datos.");
    sectionTitle("Ayuda");
    const all = a.qualified + a.scheduled + a.claimed;
    if (all === 0) empty("Wala pang naka-encode na ayuda.");
    else {
      kpis([
        { label: "Nakuha na ng qualified", value: `${a.claimedPct ?? 0}%`, tone: GREEN },
        { label: "Hindi pa nakukuha", value: String(a.qualified + a.scheduled), tone: AMBER },
        { label: "Batch na nagawa", value: String(a.batches) },
      ]);
      bar("Qualified", a.qualified, all, String(a.qualified));
      bar("Naka-schedule", a.scheduled, all, String(a.scheduled));
      bar("Nakuha na", a.claimed, all, String(a.claimed), GREEN);
    }
    y += 5;
    sectionTitle("Mga residente");
    kpis([
      { label: "Account", value: String(a.residents.total) },
      { label: "Household", value: String(a.residents.households) },
      { label: "Verified", value: a.residents.total ? `${Math.round((a.residents.verified / a.residents.total) * 100)}%` : "0%" },
    ]);
    const m = Math.max(1, ...a.puroks.map((r) => r.members));
    a.puroks.forEach((r) => bar(r.purok, r.members, m, String(r.members), BLUE, 30));
    y += 5;
    sectionTitle("Reklamo");
    textRow("Bukas pa", String(a.complaints.open), a.complaints.open > 5 ? AMBER : INK);
    textRow("Naayos o isinara", String(a.complaints.closed));
  };

  /* ---------- Transaksyon ---------- */
  const pageTransaksyon = () => {
    open("transaksyon");
    sectionTitle("Buod ng transaksyon", `${s.total} lahat`);
    kpis([
      { label: "Kabuuan", value: String(s.total), note: s.change === null ? "Walang ikukumpara" : `${s.change >= 0 ? "+" : ""}${s.change}% sa nakaraan` },
      { label: "Naghihintay", value: String(s.pending), tone: AMBER },
      { label: "Tapos na", value: String(s.done), tone: GREEN },
      { label: "Hindi natuloy", value: String(s.rejected), tone: RED },
    ]);
    sectionTitle("Ayon sa serbisyo");
    const top = Math.max(1, ...s.byService.map((e) => e.count));
    if (s.byService.length === 0) empty("Walang transaksyon sa panahong ito.");
    s.byService.slice(0, 7).forEach((e) => bar(e.service, e.count, top, `${e.count}  (${s.total ? Math.round((e.count / s.total) * 100) : 0}%)`, BLUE, 40));
    y += 3;
    sectionTitle("Pinakabagong transaksyon", "may buong listahan sa CSV");
    const cols = [
      { t: "PETSA", w: 24 },
      { t: "RESIDENTE", w: 38 },
      { t: "SERBISYO", w: 26 },
      { t: "DETALYE", w: 48 },
      { t: "KATAYUAN", w: 24 },
      { t: "REF", w: 22 },
    ];
    fill(NAVY);
    doc.rect(MARGIN, y, W, 6, "F");
    color([255, 255, 255]);
    font("bold", 6.6);
    let hx = MARGIN + 2;
    cols.forEach((c) => {
      doc.text(c.t, hx, y + 4);
      hx += c.w;
    });
    y += 6;
    const rows = input.txns.slice(0, 14);
    rows.forEach((t, i) => {
      if (i % 2 === 1) {
        fill(SOFT);
        doc.rect(MARGIN, y, W, 6.6, "F");
      }
      const d = new Date(t.at);
      const when = `${d.toLocaleDateString("fil-PH", { month: "short", day: "numeric" })} ${d.toLocaleTimeString("fil-PH", { hour: "numeric", minute: "2-digit" })}`;
      const cells = [when, t.name, t.service, t.detail, STATUS_WORD[t.status], t.ref];
      let x = MARGIN + 2;
      cells.forEach((c, ci) => {
        font(ci === 1 ? "bold" : "normal", 7);
        if (ci === 4) color(t.status === "done" ? GREEN : t.status === "rejected" ? RED : AMBER);
        else color(ci === 0 || ci === 5 ? MUTED : INK);
        doc.text(fit(c, cols[ci].w - 3), x, y + 4.4);
        x += cols[ci].w;
      });
      y += 6.6;
    });
    if (s.total > rows.length) {
      color(MUTED);
      font("italic", 7);
      doc.text(safe(`... at ${s.total - rows.length} pa. Kunin ang buong listahan sa CSV.`), MARGIN, y + 4);
    }
    if (input.truncated) {
      color(MUTED);
      font("italic", 7);
      doc.text("Paalala: may serbisyong lampas sa limitasyon ng pagbasa; maaaring mas marami ang aktuwal na bilang.", MARGIN, y + 9);
    }
  };

  const pages: Record<PdfTab, () => void> = { buod: pageBuod, kalusugan: pageKalusugan, proyekto: pageProyekto, ayuda: pageAyuda, transaksyon: pageTransaksyon };
  (["buod", "kalusugan", "proyekto", "ayuda", "transaksyon"] as PdfTab[]).filter((t) => input.tabs.includes(t)).forEach((t) => pages[t]());

  /* ---------- Signatures on the last page ---------- */
  const sigY = PAGE_H - 34;
  const sigW = 70;
  stroke(INK);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, sigY, MARGIN + sigW, sigY);
  doc.line(PAGE_W - MARGIN - sigW, sigY, PAGE_W - MARGIN, sigY);
  color(INK);
  font("bold", 9);
  doc.text(safe(input.preparedBy) || " ", MARGIN, sigY + 4.6);
  doc.text(safe(input.captainName) || " ", PAGE_W - MARGIN - sigW, sigY + 4.6);
  color(MUTED);
  font("normal", 7.5);
  doc.text(safe(`Inihanda ni (${input.preparedRole})`), MARGIN, sigY + 8.6);
  doc.text("Pinagtibay ni, Punong Barangay", PAGE_W - MARGIN - sigW, sigY + 8.6);

  /* ---------- Footer on every page ---------- */
  const total = doc.getNumberOfPages();
  const stamp = new Date().toLocaleString("fil-PH", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    stroke(GOLD);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);
    color(MUTED);
    font("normal", 7);
    doc.text(safe(`Barangay Malineng  |  Awtomatikong ulat mula sa Malineng Portal  |  Nabuo noong ${stamp}`), MARGIN, PAGE_H - 9.5);
    doc.text(`Pahina ${p} ng ${total}`, PAGE_W - MARGIN, PAGE_H - 9.5, { align: "right" });
  }

  doc.save(filename);
}
