import type { Timestamp } from "firebase/firestore";

/** One line of the Posted Computerized Voters List (PCVL). */
export interface PrecinctVoter {
  id: string;
  /** Display name exactly as printed: "SANTOS, MARIA L." */
  name: string;
  /** Normalized "lastname firstnames" used for prefix search. */
  nameKey: string;
  address: string;
  /** Precinct number, e.g. "0123A". */
  precinct: string;
  /** ACTIVE, DEACTIVATED, etc. */
  remarks: string;
}

export interface PrecinctMeta {
  count: number;
  precincts: string[];
  /** Free text shown to residents, e.g. "Mayo 12, 2026". */
  electionDate: string;
  electionName: string;
  /** Polling place per precinct (the PCVL itself does not print it). */
  defaultPlace: string;
  places: Record<string, string>;
  /** Date the printed list was posted, shown in the disclaimer. */
  listDate: string;
  uploadedAt?: Timestamp;
}

export interface PrecinctStats {
  searches: number;
  found: number;
  notFound: number;
}

/** A row being reviewed before it is saved. */
export interface DraftRow {
  key: string;
  name: string;
  address: string;
  precinct: string;
  remarks: string;
}

export const MAX_RESULTS = 5;
/** Firestore rule caps resident queries at this many documents. */
export const QUERY_LIMIT = 20;

/** lower-case, no accents (ñ -> n), letters/digits/spaces only. */
export function normalizeKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Santos", "Maria" -> "santos maria" (prefix key used by the search query). */
export function searchKey(last: string, first: string): string {
  return normalizeKey(`${last} ${first}`);
}

/** Name as printed ("LAST, FIRST M.") -> normalized key "last first m". */
export function nameToKey(name: string): string {
  const [last = "", ...rest] = name.split(",");
  return normalizeKey(`${last} ${rest.join(" ")}`);
}

export function cleanPrecinct(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 8);
}

export function cleanName(value: string): string {
  return value.toUpperCase().replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
}

/** Valid = "LAST, FIRST ..." with letters only, and a plausible precinct number. */
export function rowProblem(row: Pick<DraftRow, "name" | "precinct">): string {
  const name = cleanName(row.name);
  if (!/^[A-ZÑ][A-ZÑ'.\- ]*, [A-ZÑ][A-ZÑ'.\- ]+$/.test(name)) return "Hindi tamang pangalan (dapat APELYIDO, PANGALAN)";
  if (name.length < 5) return "Masyadong maikli ang pangalan";
  if (!/^\d{3,5}[A-Z]{0,2}$/.test(cleanPrecinct(row.precinct))) return "Hindi tamang presinto";
  return "";
}

/** Stable doc id: re-uploading the same page overwrites instead of duplicating. */
export async function rowId(row: Pick<DraftRow, "name" | "address" | "precinct">): Promise<string> {
  const text = `${cleanPrecinct(row.precinct)}|${nameToKey(row.name)}|${normalizeKey(row.address)}`;
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .slice(0, 10)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${cleanPrecinct(row.precinct)}_${hex}`;
}

/* ------------------------------ OCR text parsing ------------------------------ */

export interface ParsedPage {
  precinct: string;
  rows: Omit<DraftRow, "key">[];
}

const REMARKS = /\b(ACTIVE|INACTIVE|DEACTIVATED|TRANSFERRED|DELETED|DECEASED)\b/i;
const PRECINCT_TOKEN = /\b\d{3,5}[A-Z]{1,2}\b/;
const STREET_WORD = /\b(ST|AVE|RD|ROAD|STREET|BLVD|PUROK|BRGY|CITY)\b\.?/;
const NAME_AT_START = /^([A-ZÑ][A-ZÑ'.\-]*(?: [A-ZÑ'.\-]+)*,\s*[A-ZÑ][A-ZÑ'.\-]*(?: [A-ZÑ'.\-]+)*)(.*)$/;

/** "1 DELA CRUZ, JUAN M. 0123A ACTIVE" -> name + the rest of the line, or null if it is not a name line. */
function matchNameLine(line: string): { name: string; rest: string } | null {
  const candidates = [line, line.replace(/^\d{1,4}[.)\s]+/, "")];
  for (const text of candidates) {
    const m = text.match(NAME_AT_START);
    if (m && !STREET_WORD.test(m[1])) return { name: m[1].trim(), rest: m[2].trim() };
  }
  return null;
}

/**
 * Turn raw OCR text of one PCVL page into rows.
 * The printed table is: No. | "LAST, FIRST M." | address | precinct | remarks.
 * OCR may print the address on the line before or after the name, so lines that are
 * not a name are kept as the address of the row they belong to: after a name when
 * that row is not finished yet, otherwise before the next name.
 */
export function parsePcvlText(text: string): ParsedPage {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/SAMPLE ONLY/gi, " ").replace(/[|‘’]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // Page header: "Precinct No.: 0123A"
  const header = text.match(/Precinct\s*No\.?\s*[:.]?\s*([0-9]{3,5}[A-Z]{0,2})/i);
  const pagePrecinct = header ? cleanPrecinct(header[1]) : "";

  const rows: ParsedPage["rows"] = [];
  let current: { name: string; before: string[]; rest: string[]; done: boolean } | null = null;
  let pending: string[] = [];

  const flush = () => {
    if (!current) return;
    const joined = current.rest.join(" ");
    const remarks = (joined.match(REMARKS)?.[1] ?? "").toUpperCase();
    const precinct = joined.match(PRECINCT_TOKEN)?.[0] ?? "";
    const after = joined.replace(REMARKS, " ").replace(PRECINCT_TOKEN, " ");
    const address = [...current.before, after]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[,.\s]+|[,.\s]+$/g, "");
    rows.push({ name: cleanName(current.name), address, precinct: pagePrecinct || cleanPrecinct(precinct), remarks: remarks || "ACTIVE" });
    current = null;
  };

  for (const line of lines) {
    // Skip page furniture.
    if (/last name,?\s*first name/i.test(line)) continue;
    if (/^(republic|commission|posted computerized|region|city\/|precinct no|voter'?s name|\(?last name|no\.?\s+voter|for illustration|this is a sample)/i.test(line)) continue;
    const m = matchNameLine(line);
    if (m) {
      flush();
      current = { name: m.name, before: pending, rest: m.rest ? [m.rest] : [], done: REMARKS.test(m.rest) };
      pending = [];
    } else if (current && !current.done) {
      current.rest.push(line);
      if (REMARKS.test(line)) current.done = true;
    } else {
      pending.push(line);
    }
  }
  flush();
  return { precinct: pagePrecinct, rows };
}

/* ------------------------------- CSV parsing ------------------------------- */

/** Minimal RFC 4180 parser (quoted fields, commas, CRLF). */
export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((v) => v.trim())) out.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim())) out.push(row);
  return out;
}

export type CsvField = "full" | "last" | "first" | "middle" | "address" | "precinct" | "remarks";

/** Guess which CSV column holds what, from the header names. */
export function guessCsvColumns(header: string[]): Partial<Record<CsvField, number>> {
  const find = (re: RegExp) => {
    const i = header.findIndex((h) => re.test(h.trim()));
    return i >= 0 ? i : undefined;
  };
  return {
    full: find(/^(voter'?s?\s*)?name$|^pangalan$|^full\s*name$/i),
    last: find(/last\s*name|surname|apelyido/i),
    first: find(/first\s*name|given/i),
    middle: find(/middle/i),
    address: find(/address|tirahan|purok/i),
    precinct: find(/precinct|presinto/i),
    remarks: find(/remark|status/i),
  };
}

export function csvToRows(data: string[][], map: Partial<Record<CsvField, number>>): Omit<DraftRow, "key">[] {
  const at = (r: string[], k: CsvField) => (map[k] === undefined ? "" : (r[map[k] as number] ?? "").trim());
  return data.map((r) => {
    let name = at(r, "full");
    if (!name) {
      const first = [at(r, "first"), at(r, "middle")].filter(Boolean).join(" ");
      name = `${at(r, "last")}, ${first}`;
    }
    return { name: cleanName(name), address: at(r, "address"), precinct: cleanPrecinct(at(r, "precinct")), remarks: (at(r, "remarks") || "ACTIVE").toUpperCase() };
  });
}
