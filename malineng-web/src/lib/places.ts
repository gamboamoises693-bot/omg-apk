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
