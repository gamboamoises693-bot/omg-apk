import type { Timestamp } from "firebase/firestore";

export type OpeningState = "open" | "full" | "closed";
export type ApplicationStatus = "new" | "interview" | "hired" | "rejected";

export interface Opening {
  id: string;
  posterId: string;
  posterName: string;
  /** Business / farm / office that is hiring. */
  employer: string;
  title: string;
  /** How many people are needed, and how many were already hired. */
  slots: number;
  filled: number;
  type: (typeof OPENING_TYPES)[number];
  salary: string;
  /** YYYY-MM-DD or "" (no deadline). */
  deadline: string;
  requirements: string[];
  /** Hours, benefits and other notes. */
  details: string;
  purok: string;
  contact: string;
  /** "website" = people apply here; "contact" = call or visit. */
  applyMode: "website" | "contact";
  /** Posted by the Barangay (Kapitan / Secretary / Super Admin). */
  official: boolean;
  status: "pending" | "approved" | "rejected";
  state: OpeningState;
  createdAt?: Timestamp;
}

export interface Application {
  id: string;
  openingId: string;
  openingTitle: string;
  employerId: string;
  applicantId: string;
  applicantName: string;
  purok: string;
  contact: string;
  /** Age in years when applying (from the profile birthday), or null. */
  age: number | null;
  verified: boolean;
  skills: string[];
  message: string;
  status: ApplicationStatus;
  createdAt?: Timestamp;
}

export const OPENING_TYPES = ["Full-time", "Part-time", "Pana-panahon"] as const;

export const APPLICATION_STATUS: Record<ApplicationStatus, { label: string; badge: "gold" | "blue" | "green" | "gray" }> = {
  new: { label: "Naghihintay", badge: "gold" },
  interview: { label: "Para sa interview", badge: "blue" },
  hired: { label: "Natanggap!", badge: "green" },
  rejected: { label: "Hindi natanggap", badge: "gray" },
};

/** Days left until the deadline (0 = today, negative = passed), or null when there is none. */
export function daysLeft(deadline: string, now = new Date()): number | null {
  if (!deadline) return null;
  const d = new Date(`${deadline}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

export function deadlineLabel(deadline: string): string {
  const d = daysLeft(deadline);
  if (d === null) return "Walang deadline";
  if (d < 0) return "Tapos na ang deadline";
  if (d === 0) return "Deadline ngayong araw";
  if (d === 1) return "1 araw na lang";
  return `${d} araw na lang`;
}

/** Still taking applications: approved, not full or closed, deadline not passed. */
export function isTakingApplications(o: Opening): boolean {
  const d = daysLeft(o.deadline);
  return o.status === "approved" && o.state === "open" && (d === null || d >= 0);
}

export function slotsLabel(o: Pick<Opening, "slots" | "filled">): string {
  const left = Math.max(0, o.slots - o.filled);
  return left === 0 ? "Puno na" : left === 1 ? "1 bakante" : `${left} bakante`;
}

/** application doc id: one application per person per opening (enforced by the rules too). */
export function applicationId(openingId: string, uid: string): string {
  return `${openingId}_${uid}`;
}
