import type { Timestamp } from "firebase/firestore";

export type PlaceStatus = "pending" | "approved" | "rejected";

export interface Place {
  id: string;
  name: string;
  category: string;
  purok: string;
  hours: string;
  contact: string;
  description: string;
  /** Small data URL ("" = none). */
  photo: string;
  lat: number;
  lng: number;
  status: PlaceStatus;
  ownerId: string;
  ownerName: string;
  rejectReason?: string;
  createdAt?: Timestamp;
}

export const EVACUATION = "Evacuation Center";

/** Category → pin color. Evacuation centers are added by admins only. */
export const PLACE_CATEGORIES: { name: string; color: string }[] = [
  { name: "Tindahan", color: "#D97706" },
  { name: "Kainan", color: "#EA580C" },
  { name: "Gobyerno", color: "#1F5FAE" },
  { name: "Paaralan", color: "#0891B2" },
  { name: "Simbahan", color: "#7C3AED" },
  { name: "Serbisyo", color: "#DB2777" },
  { name: "Farm / Bigasan", color: "#059669" },
  { name: EVACUATION, color: "#DC2626" },
  { name: "Iba pa", color: "#4B5563" },
];

/** Inside-the-pin icon per category: SVG path data (24x24, stroke). */
const CATEGORY_ICON: Record<string, string> = {
  Tindahan: "M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6",
  Kainan: "M7 3v8a2 2 0 002 2v8M7 3v6M11 3v6M15 3c-2 2-2 6 0 8v10",
  Gobyerno: "M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M3 10l9-6 9 6",
  Paaralan: "M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5",
  Simbahan: "M12 3v5M9.5 5.5h5M5 21V12l7-4 7 4v9M10 21v-5h4v5",
  Serbisyo: "M14 6a4 4 0 004 4l-9 9a2 2 0 01-3-3l9-9a4 4 0 01-1-1z",
  "Farm / Bigasan": "M12 21c0-6 2-9 7-11-1 6-3 9-7 11zM12 21c0-5-2-8-7-10 1 5 3 8 7 10z",
  [EVACUATION]: "M12 3l10 18H2zM12 10v5M12 18v.5",
  "Iba pa": "M12 13a3 3 0 100-6 3 3 0 000 6zM12 21s-7-6-7-12a7 7 0 0114 0c0 6-7 12-7 12z",
};
export function categoryIconPath(category: string): string {
  return CATEGORY_ICON[category] ?? CATEGORY_ICON["Iba pa"];
}

export function categoryColor(category: string): string {
  return PLACE_CATEGORIES.find((c) => c.name === category)?.color ?? "#4B5563";
}

/** Default map center: Cuyapo, Nueva Ecija (an admin sets Malineng's exact center from the map). */
export const DEFAULT_MAP_CENTER = { lat: 15.7787, lng: 120.6608, zoom: 15 };

export const PLACE_REJECT_REASONS = [
  "Mali ang lokasyon ng pin",
  "Kulang o mali ang detalye",
  "Hindi ito nasa Barangay Malineng",
  "Doble (nakapin na)",
] as const;

/** Opens turn-by-turn directions in the phone's Google Maps app (free, no API key). */
export function directionsUrl(p: Pick<Place, "lat" | "lng">): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
}

/** Straight-line distance in metres between two points. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}
