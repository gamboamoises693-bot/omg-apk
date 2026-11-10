import type { Timestamp } from "firebase/firestore";
import type {
  AlertType,
  AppointmentService,
  AppointmentStatus,
  ListingCategory,
} from "./constants";

export type ModerationStatus = "pending" | "approved" | "rejected";

export interface UserProfile {
  uid: string;
  fullName: string;
  purok: string;
  contact: string;
  birthday: string;
  email?: string;
  role: "resident" | "admin" | "superadmin";
  /** Admin position, e.g. "Kapitan", "Secretary". Kapitan approves ambulance trips. */
  position?: string;
  /** Admin-only profile photo (small data URL). */
  photoURL?: string;
  suspended?: boolean;
  createdAt?: Timestamp;
}

export type VerificationStatus = "pending" | "verified" | "rejected";

export interface Verification {
  id: string; // = uid
  uid: string;
  fullName: string;
  purok: string;
  birthday: string;
  contact: string;
  email: string;
  selfie: string; // compressed data URL
  status: VerificationStatus;
  reason?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  submittedAt?: Timestamp;
  reviewedAt?: Timestamp;
}

export interface ActivityLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  type: string;
  text: string;
  targetId?: string;
  createdAt?: Timestamp;
}

export interface IssuedDocument {
  id: string;
  type: "Barangay Clearance" | "Indigency";
  fullName: string;
  purok: string;
  purpose: string;
  appointmentId: string;
  issuedByName: string;
  signatory: string;
  valid: boolean;
  issuedAt?: Timestamp;
}

export interface HouseholdMember {
  name: string;
  relation: string;
  birthday: string;
  sex: "Lalaki" | "Babae";
}

export interface Household {
  id: string; // = head's uid
  headName: string;
  purok: string;
  address: string;
  members: HouseholdMember[];
  updatedAt?: Timestamp;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  purok: string;
  content: string;
  photoURL: string;
  status: ModerationStatus;
  likes: string[];
  createdAt?: Timestamp;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt?: Timestamp;
}

export interface Listing {
  id: string;
  sellerId: string;
  sellerName: string;
  title: string;
  price: number;
  category: ListingCategory;
  description: string;
  photoURL: string;
  contact: string;
  messengerLink: string;
  purok: string;
  status: ModerationStatus;
  expiresAt?: Timestamp;
  createdAt?: Timestamp;
}

export interface Job {
  id: string;
  posterId: string;
  posterName: string;
  title: string;
  purok: string;
  salary: string;
  contact: string;
  category: string;
  status: "pending" | "approved" | "rejected";
  createdAt?: Timestamp;
}

export interface Skill {
  id: string;
  userId: string;
  name: string;
  /** One of SKILL_TYPES, or any skill the person wrote themselves (max 40 characters). */
  skill: string;
  purok: string;
  contact: string;
  createdAt?: Timestamp;
}

export interface LostFoundItem {
  id: string;
  userId: string;
  type: "nawawala" | "nakita";
  item: string;
  location: string;
  description: string;
  photoURL: string;
  contact: string;
  status: "open" | "nakabalik";
  createdAt?: Timestamp;
}

export interface Ayuda {
  id: string; // = controlNumber
  fullName: string;
  nameLower: string;
  controlNumber: string;
  program: string;
  status: "qualified" | "scheduled" | "claimed";
  remarks: string;
  updatedAt?: Timestamp;
}

export interface Appointment {
  id: string;
  userId: string;
  fullName: string;
  service: AppointmentService;
  date: string; // YYYY-MM-DD
  contact: string;
  notes?: string;
  /** Set when an admin issued the printable document (issuedDocuments/{id}). */
  documentId?: string;
  status: AppointmentStatus;
  createdAt?: Timestamp;
}

export interface Registration {
  id: string;
  userId: string;
  fullName: string;
  purok: string;
  contact: string;
  purpose: string;
  createdAt?: Timestamp;
}

export interface PollVote {
  uid: string;
  option: number;
}

export interface Poll {
  id: string;
  question: string;
  options: string[];
  votes: PollVote[];
  voters: string[];
  createdBy: string;
  isActive: boolean;
  createdAt?: Timestamp;
}

export interface BarangayEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  description: string;
  location: string;
  createdBy: string;
  createdAt?: Timestamp;
}

export interface PurokPoints {
  id: string;
  purok: string;
  points: number;
  cleanupCount: number;
}

export interface Official {
  name: string;
  position: string;
  /** Small compressed photo (data URL) stored in settings/main. */
  photoURL?: string;
}

export interface Announcement {
  title: string;
  body: string;
  date: string;
}

export interface Project {
  name: string;
  progress: number; // 0-100
}

export interface Hotline {
  name: string;
  numbers: string[];
}

export type InfraProjectStatus = "planned" | "ongoing" | "completed" | "delayed";

export interface ProjectUpdate {
  date: string; // YYYY-MM-DD
  note: string;
}

/** Detailed transparency project (Full Disclosure). Full-size photos live in projectPhotos/{id}. */
export interface InfraProject {
  id: string;
  name: string;
  category: string;
  description: string;
  location: string;
  budget: number;
  fundSource: string;
  implementer: string;
  startDate: string;
  targetDate: string;
  completedDate: string;
  status: InfraProjectStatus;
  progress: number; // 0-100
  /** Small thumbnails for lists (data URLs). */
  beforeThumb: string;
  afterThumb: string;
  updates: ProjectUpdate[];
  createdAt?: import("firebase/firestore").Timestamp;
  updatedAt?: import("firebase/firestore").Timestamp;
}

export interface EmergencyNumbers {
  tanod: string;
  healthCenter: string;
  bfp: string;
}

export type AmbulanceAvailability = "available" | "busy" | "maintenance";

export interface AmbulanceSettings {
  phone: string;
  drivers: string[];
  status: AmbulanceAvailability;
  /** Blank = Libre. Otherwise shown as-is, e.g. "₱200 para sa gas". */
  fee: string;
}

export type AmbulanceRequestStatus = "pending" | "approved" | "enroute" | "done" | "rejected" | "cancelled";

export interface AmbulanceRequest {
  id: string;
  userId: string;
  type: "emergency" | "schedule";
  patientName: string;
  purok: string;
  reason: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (24h)
  pickup: string;
  destination: string;
  notes: string;
  contact: string;
  status: AmbulanceRequestStatus;
  driver?: string;
  durationHours?: number;
  adminNote?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/** Public, anonymous busy window (no patient data) so residents can see availability. */
export interface AmbulanceSlot {
  id: string; // = request id
  date: string;
  start: string; // HH:mm
  end: string; // HH:mm
  status: "approved" | "enroute";
}

export interface Settings {
  /** Barangay seal/logo (data URL). Empty = default "M" mark. */
  logoURL: string;
  /** Show the live heat index banner (El Niño monitoring). Default: on. */
  showHeatIndex: boolean;
  /** Center of the Malineng map (set by an admin from the map page). */
  mapCenter?: { lat: number; lng: number; zoom: number };
  ambulance: AmbulanceSettings;
  puroks: string[];
  alertBanner: string;
  alertType: AlertType;
  emergencyNumbers: EmergencyNumbers;
  hotlines: Hotline[];
  officials: Official[];
  announcements: Announcement[];
  projects: Project[];
}
