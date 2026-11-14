import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";

/** Who may open a feature. "off" hides it from residents ("Malapit na"). */
export type AccessLevel = "all" | "login" | "verified" | "off";

export const ACCESS_LABEL: Record<AccessLevel, string> = { all: "Lahat", login: "Login", verified: "Verified", off: "Off" };
export const ACCESS_LEVELS: AccessLevel[] = ["all", "login", "verified", "off"];

export interface WebFeature {
  /** First URL segment, also the key stored in Firestore. */
  key: string;
  label: string;
}

/** Every service a Super Admin can switch. SOS/Emergency, login and account are always open. */
export const WEB_FEATURES: WebFeature[] = [
  { key: "presinto", label: "Presinto Finder" },
  { key: "chat", label: "Chat ng Barangay" },
  { key: "tindahan", label: "Tindahan" },
  { key: "hiring", label: "Hiring" },
  { key: "ayuda", label: "Ayuda" },
  { key: "appointment", label: "Appointment" },
  { key: "ambulansya", label: "Ambulansya" },
  { key: "botika", label: "Botika" },
  { key: "hiraman", label: "Hiraman" },
  { key: "mapa", label: "Mapa" },
  { key: "pabatid", label: "Pabatid" },
  { key: "survey", label: "Survey" },
  { key: "pondo", label: "Pondo" },
  { key: "barangay-id", label: "Barangay ID" },
  { key: "reklamo", label: "Reklamo" },
  { key: "kalusugan", label: "Kalusugan" },
  { key: "liga", label: "Liga at Palaro" },
  { key: "lost-found", label: "Lost & Found" },
  { key: "skills", label: "Skills" },
  { key: "proyekto", label: "Proyekto" },
  { key: "desisyon", label: "Mga Desisyon" },
  { key: "raffle", label: "Raffle" },
  { key: "board", label: "Board" },
  { key: "register-event", label: "Magpa-rehistro" },
  { key: "events", label: "Events" },
  { key: "botohan", label: "Botohan" },
  { key: "purok", label: "Purok Points" },
];

/** The voters list is private, so it needs a login even before a Super Admin touches Web Access. */
const DEFAULT_LEVEL: Record<string, AccessLevel> = { presinto: "login", chat: "verified", tindahan: "login", hiring: "login", skills: "login", "lost-found": "login" };

export type PresetKey = "lahat" | "pangunahin" | "eleksyon" | "custom";

const PRIMARY = ["presinto", "appointment", "ambulansya", "pabatid", "barangay-id", "reklamo", "proyekto", "mapa"];

export const PRESETS: { key: Exclude<PresetKey, "custom">; label: string }[] = [
  { key: "lahat", label: "Lahat bukas" },
  { key: "pangunahin", label: "Pangunahin lang" },
  { key: "eleksyon", label: "Eleksyon mode" },
];

export interface WebAccessDoc {
  features: Record<string, AccessLevel>;
  preset: PresetKey;
  /** Pins Presinto Finder + a reminder on the Home screen. */
  electionMode: boolean;
}

export function presetLevels(preset: Exclude<PresetKey, "custom">): Record<string, AccessLevel> {
  const out: Record<string, AccessLevel> = {};
  for (const f of WEB_FEATURES) {
    if (preset === "pangunahin") out[f.key] = PRIMARY.includes(f.key) ? (DEFAULT_LEVEL[f.key] ?? "all") : "off";
    else out[f.key] = DEFAULT_LEVEL[f.key] ?? "all";
  }
  return out;
}

/** These pages show people's phone numbers, so the database only gives them to signed-in people ("Lahat" is not allowed). */
export const LOGIN_ONLY = ["tindahan", "hiring", "skills", "lost-found"];

export function levelOf(doc: Pick<WebAccessDoc, "features"> | null, key: string): AccessLevel {
  const v = doc?.features?.[key];
  const level: AccessLevel = v === "all" || v === "login" || v === "verified" || v === "off" ? v : (DEFAULT_LEVEL[key] ?? "all");
  return level === "all" && LOGIN_ONLY.includes(key) ? "login" : level;
}

/** Live settings/webAccess (guests can read it too). `null` while loading or never saved. */
export function useWebAccess() {
  const [data, setData] = useState<WebAccessDoc | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      onSnapshot(
        doc(db, "settings", "webAccess"),
        (snap) => {
          const d = snap.data();
          setData(d ? { features: (d.features as Record<string, AccessLevel>) ?? {}, preset: (d.preset as PresetKey) ?? "custom", electionMode: d.electionMode === true } : null);
          setLoading(false);
        },
        () => setLoading(false),
      ),
    [],
  );
  return { access: data, loading };
}
