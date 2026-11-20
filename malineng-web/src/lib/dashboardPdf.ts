import type { Summary, Txn } from "./transactions";
import { STATUS_WORD } from "./transactions";

/**
 * Executive PDF report of the barangay's transactions (A4, portrait).
 * Built in the browser with jsPDF (loaded only when the button is pressed), so nothing is uploaded anywhere.
 * jsPDF's built-in fonts have no peso sign, so amounts are never printed in this report.
 */

export interface PdfInput {
  /** e.g. "7 araw" */
  periodLabel: string;
  /** e.g. "Nob 14, 2026 – Nob 20, 2026" */
  rangeText: string;
  summary: Summary;
  txns: Txn[];
  preparedBy: string;
  preparedRole: string;
  captainName: string;
  /** PNG data URL of the barangay seal; the report still works without it. */
  seal?: string | null;
  /** True when a source hit the read cap. */
  truncated?: boolean;
}

// Brand colors (RGB), same as the app.
const NAVY: [number, number, number] = [11, 43, 87];
const NAVY_DARK: [number, number, number] = [10, 27, 60];
const BLUE: [number, number, number] = [31, 95, 174];
const GOLD: [number, number, number] = [212, 175, 55];
const INK: [number, number, number] = [17, 24, 39];
const MUTED: [number, number, number] = [90, 100, 118];
const LINE: [number, number, number] = [227, 232, 240];
const SOFT: [number, number, number] = [244, 246, 250];
const GREEN: [number, number, number] = [4, 120, 87];
const AMBER: [number, number, number] = [113, 63, 18];
const RED: [number, number, number] = [185, 28, 28];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;

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
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { summary: s } = input;

  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
  /** jsPDF's built-in fonts only know Latin-1: swap thin spaces and anything else outside it. */
  const safe = (text: string): string => text.replace(/[\u202f\u00a0]/g, " ").replace(/[\u2013\u2014]/g, "-").replace(/[^\x20-\xFF]/g, "?");
  /** Shortens text with "..." so it fits in `width` mm. */
  const fit = (raw: string, width: number): string => {
    const text = safe(raw);
    if (doc.getTextWidth(text) <= width) return text;
    let t = text;
    while (t.length > 1 && doc.getTextWidth(`${t}...`) > width) t = t.slice(0, -1);
    return `${t}...`;
  };

  /* ---------- Page 1 header ---------- */
  setFill([0, 56, 168]);
  doc.rect(0, 0, PAGE_W / 2, 3, "F");
  setFill([206, 17, 38]);
  doc.rect(PAGE_W / 2, 0, PAGE_W / 2, 3, "F");
  setFill(NAVY_DARK);
  doc.rect(0, 3, PAGE_W, 7, "F");
  setText([255, 255, 255]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("R E P U B L I K A   N G   P I L I P I N A S", PAGE_W / 2, 7.6, { align: "center" });

  setFill(NAVY);
  doc.rect(0, 10, PAGE_W, 34, "F");
  setFill(GOLD);
  doc.rect(0, 44, PAGE_W, 1.2, "F");

  let textX = MARGIN;
  if (input.seal) {
    try {
      doc.addImage(input.seal, "PNG", MARGIN, 14, 26, 26);
      textX = MARGIN + 31;
    } catch {
      /* The report works without the seal. */
    }
  }
  setText([255, 255, 255]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("ULAT NG MGA TRANSAKSYON", textX, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Barangay Malineng, Cuyapo, Nueva Ecija", textX, 30.5);
  setText([232, 215, 140]);
  doc.setFontSize(9);
  doc.text(safe(`${input.periodLabel}  |  ${input.rangeText}`), textX, 36.5);

  /* ---------- KPI cards ---------- */
  let y = 54;
  const kpis: { label: string; value: number; note: string; color: [number, number, number] }[] = [
    { label: "KABUUANG TRANSAKSYON", value: s.total, note: s.change === null ? "Walang ikukumpara" : `${s.change >= 0 ? "+" : ""}${s.change}% sa nakaraang panahon`, color: NAVY },
    { label: "NAGHIHINTAY", value: s.pending, note: "Kailangan pa ng aksyon", color: AMBER },
    { label: "TAPOS NA", value: s.done, note: s.total ? `${Math.round((s.done / s.total) * 100)}% ng lahat` : "—", color: GREEN },
    { label: "HINDI NATULOY", value: s.rejected, note: s.total ? `${Math.round((s.rejected / s.total) * 100)}% ng lahat` : "—", color: RED },
  ];
  const gap = 4;
  const cardW = (PAGE_W - MARGIN * 2 - gap * 3) / 4;
  kpis.forEach((k, i) => {
    const x = MARGIN + i * (cardW + gap);
    setFill([255, 255, 255]);
    setDraw(LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, 28, 2, 2, "FD");
    setFill(k.color);
    doc.rect(x, y + 4, 1.2, 20, "F");
    setText(MUTED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);
    doc.text(k.label, x + 4, y + 7.5);
    setText(k.color);
    doc.setFontSize(22);
    doc.text(String(k.value), x + 4, y + 18);
    setText(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    doc.text(fit(k.note, cardW - 6), x + 4, y + 24);
  });
  y += 38;

  /* ---------- Section title helper ---------- */
  const sectionTitle = (title: string, subtitle = "") => {
    setFill(GOLD);
    doc.rect(MARGIN, y - 3.6, 1, 4.6, "F");
    setText(NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text(title.toUpperCase(), MARGIN + 3, y);
    if (subtitle) {
      setText(MUTED);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(subtitle, PAGE_W - MARGIN, y, { align: "right" });
    }
    y += 6;
  };

  /* ---------- By service ---------- */
  sectionTitle("Ayon sa serbisyo", `${s.byService.length} serbisyo`);
  const top = Math.max(1, ...s.byService.map((e) => e.count));
  const labelW = 38;
  const barMax = PAGE_W - MARGIN * 2 - labelW - 40;
  if (s.byService.length === 0) {
    setText(MUTED);
    doc.setFontSize(9);
    doc.text("Walang transaksyon sa panahong ito.", MARGIN, y + 3);
    y += 10;
  }
  s.byService.forEach((e) => {
    setText(INK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(fit(e.service, labelW - 2), MARGIN, y + 3.2);
    setFill(SOFT);
    doc.roundedRect(MARGIN + labelW, y, barMax, 4.6, 1.3, 1.3, "F");
    setFill(BLUE);
    doc.roundedRect(MARGIN + labelW, y, Math.max(2, (e.count / top) * barMax), 4.6, 1.3, 1.3, "F");
    doc.setFont("helvetica", "bold");
    setText(INK);
    doc.text(String(e.count), MARGIN + labelW + barMax + 4, y + 3.4);
    doc.setFont("helvetica", "normal");
    setText(MUTED);
    doc.setFontSize(7.5);
    doc.text(`${s.total ? Math.round((e.count / s.total) * 100) : 0}%  |  ${e.pending} naghihintay`, PAGE_W - MARGIN, y + 3.4, { align: "right" });
    y += 7.4;
  });
  y += 4;

  /* ---------- Trend (per day, or per month for a whole year) ---------- */
  const monthly = s.byDay.length > 62;
  const buckets = (() => {
    if (!monthly) return s.byDay.map((d) => ({ label: d.day.slice(8), count: d.count }));
    const m = new Map<string, number>();
    s.byDay.forEach((d) => m.set(d.day.slice(0, 7), (m.get(d.day.slice(0, 7)) ?? 0) + d.count));
    return [...m.entries()].map(([k, count]) => ({ label: k.slice(5), count }));
  })();
  if (buckets.length > 1) {
    sectionTitle(monthly ? "Bawat buwan" : "Bawat araw", `pinakamarami: ${Math.max(...buckets.map((b) => b.count))}`);
    const chartH = 26;
    const chartW = PAGE_W - MARGIN * 2;
    const peak = Math.max(1, ...buckets.map((b) => b.count));
    setDraw(LINE);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, y + chartH, MARGIN + chartW, y + chartH);
    const slot = chartW / buckets.length;
    const barW = Math.min(8, slot * 0.7);
    buckets.forEach((b, i) => {
      const h = (b.count / peak) * (chartH - 4);
      setFill(BLUE);
      doc.rect(MARGIN + i * slot + (slot - barW) / 2, y + chartH - h, barW, h, "F");
      if (buckets.length <= 16) {
        setText(MUTED);
        doc.setFontSize(6.5);
        doc.text(b.label, MARGIN + i * slot + slot / 2, y + chartH + 3.6, { align: "center" });
      }
    });
    y += chartH + 10;
  }

  /* ---------- Details table ---------- */
  const columns = [
    { title: "PETSA", w: 24 },
    { title: "RESIDENTE", w: 40 },
    { title: "SERBISYO", w: 26 },
    { title: "DETALYE", w: 46 },
    { title: "KATAYUAN", w: 24 },
    { title: "REF", w: 22 },
  ];
  const drawTableHead = () => {
    setFill(NAVY);
    doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 6.4, "F");
    setText([255, 255, 255]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    let x = MARGIN + 2;
    columns.forEach((c) => {
      doc.text(c.title, x, y + 4.3);
      x += c.w;
    });
    y += 6.4;
  };
  const newPage = () => {
    doc.addPage();
    setFill([0, 56, 168]);
    doc.rect(0, 0, PAGE_W / 2, 3, "F");
    setFill([206, 17, 38]);
    doc.rect(PAGE_W / 2, 0, PAGE_W / 2, 3, "F");
    y = 14;
  };

  if (y > PAGE_H - 60) newPage();
  sectionTitle("Listahan ng mga transaksyon", `${input.txns.length} lahat`);
  drawTableHead();
  const rowH = 7;
  input.txns.forEach((t, i) => {
    if (y + rowH > PAGE_H - 22) {
      newPage();
      drawTableHead();
    }
    if (i % 2 === 1) {
      setFill(SOFT);
      doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, rowH, "F");
    }
    const d = new Date(t.at);
    const when = `${d.toLocaleDateString("fil-PH", { month: "short", day: "numeric" })} ${d.toLocaleTimeString("fil-PH", { hour: "numeric", minute: "2-digit" })}`;
    const cells = [safe(when), t.name, t.service, t.detail, `${STATUS_WORD[t.status]}`, t.ref];
    let x = MARGIN + 2;
    doc.setFontSize(7.2);
    cells.forEach((c, ci) => {
      doc.setFont("helvetica", ci === 1 ? "bold" : "normal");
      if (ci === 4) setText(t.status === "done" ? GREEN : t.status === "rejected" ? RED : AMBER);
      else setText(ci === 0 || ci === 5 ? MUTED : INK);
      doc.text(fit(c, columns[ci].w - 3), x, y + 4.6);
      x += columns[ci].w;
    });
    setDraw(LINE);
    doc.setLineWidth(0.15);
    doc.line(MARGIN, y + rowH, PAGE_W - MARGIN, y + rowH);
    y += rowH;
  });
  if (input.truncated) {
    y += 4;
    setText(MUTED);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.2);
    doc.text("Paalala: may serbisyong lampas sa limitasyon ng pagbasa. Maaaring mas marami ang aktuwal na bilang.", MARGIN, y);
  }

  /* ---------- Signatures ---------- */
  if (y > PAGE_H - 62) newPage();
  y += 18;
  const sigW = 70;
  setDraw(INK);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, MARGIN + sigW, y);
  doc.line(PAGE_W - MARGIN - sigW, y, PAGE_W - MARGIN, y);
  setText(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(safe(input.preparedBy) || " ", MARGIN, y + 4.6);
  doc.text(safe(input.captainName) || " ", PAGE_W - MARGIN - sigW, y + 4.6);
  doc.setFont("helvetica", "normal");
  setText(MUTED);
  doc.setFontSize(7.5);
  doc.text(safe(`Inihanda ni (${input.preparedRole})`), MARGIN, y + 8.6);
  doc.text("Pinagtibay ni, Punong Barangay", PAGE_W - MARGIN - sigW, y + 8.6);

  /* ---------- Footer on every page ---------- */
  const pages = doc.getNumberOfPages();
  const stamp = new Date().toLocaleString("fil-PH", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    setDraw(GOLD);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);
    setText(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(safe(`Barangay Malineng  |  Awtomatikong ulat mula sa Malineng Portal  |  Nabuo noong ${stamp}`), MARGIN, PAGE_H - 9.5);
    doc.text(`Pahina ${p} ng ${pages}`, PAGE_W - MARGIN, PAGE_H - 9.5, { align: "right" });
  }

  doc.save(filename);
}
