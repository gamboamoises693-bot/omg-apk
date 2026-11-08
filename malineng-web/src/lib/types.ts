import type { Timestamp } from "firebase/firestore";
import type {
  AlertType,
  AppointmentService,
  AppointmentStatus,
  ListingCategory,
  SkillType,
} from "./constants";

export type ModerationStatus = "pending" | "approved" | "rejected";

export interface UserProfile {
  uid: string;
  fullName: string;
  purok: string;
  contact: string;
  birthday: string;
  email?: string;
  role: "resident" | "admin";
  createdAt?: Timestamp;
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
  skill: SkillType;
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

export interface EmergencyNumbers {
  tanod: string;
  healthCenter: string;
  bfp: string;
}

export interface Settings {
  puroks: string[];
  alertBanner: string;
  alertType: AlertType;
  emergencyNumbers: EmergencyNumbers;
  officials: Official[];
  announcements: Announcement[];
  projects: Project[];
}
