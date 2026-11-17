import type { Timestamp } from "firebase/firestore";

/**
 * A resident registered at the Barangay Hall by the Kapitan or Secretary. The account exists right away, but it is
 * verified only after the Developer gives the final approval (hallRegistrations/{uid}). The Developer's own
 * registrations need no second approval.
 */
export interface HallRegistration {
  id: string; // = the resident's uid
  uid: string;
  fullName: string;
  purok: string;
  birthday: string;
  contact: string;
  email: string;
  /** The staff checked the ID in person (the Developer verifies the account when approving). */
  idSeen: boolean;
  /** Selfie taken at the Hall for the Barangay ID, or "". */
  selfie: string;
  registeredBy: string;
  registeredByName: string;
  status: "pending" | "approved" | "rejected";
  reason?: string;
  createdAt?: Timestamp;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: Timestamp;
}

export const HALL_REJECT_REASONS = [
  "Kulang o mali ang detalye. Pumunta sa Barangay Hall.",
  "Hindi tugma ang ID. Pumunta sa Barangay Hall dala ang ID.",
  "Hindi taga-Barangay Malineng.",
  "Duplicate na account.",
] as const;
