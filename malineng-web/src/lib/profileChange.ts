import { useEffect, useState } from "react";
import { doc, onSnapshot, type Timestamp } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Changes to a resident's identity details (name, purok, contact, birthday) need the Barangay's approval.
 * profileChanges/{uid} holds ONE request per resident (so there can be only one pending at a time).
 * The first time a field is filled in (it was empty) it is saved directly; see firestore.rules.
 */
export const IDENTITY_FIELDS = ["fullName", "purok", "contact", "birthday", "sex", "civilStatus"] as const;
export type IdentityField = (typeof IDENTITY_FIELDS)[number];
export type Identity = Record<IdentityField, string>;

export const FIELD_LABEL: Record<IdentityField, string> = {
  fullName: "Pangalan",
  purok: "Purok",
  contact: "Contact",
  birthday: "Birthday",
  sex: "Kasarian",
  civilStatus: "Civil status",
};

export const PROFILE_REJECT_REASONS = [
  "Walang katugmang ID. Pumunta sa Barangay Hall dala ang ID.",
  "Mali o hindi malinaw ang bagong detalye.",
  "Hindi taga-Barangay Malineng.",
  "Pumunta sa Barangay Hall para sa pagbabago.",
] as const;

export interface ProfileChange {
  id: string; // = uid
  uid: string;
  current: Identity;
  requested: Identity;
  status: "pending" | "approved" | "rejected";
  reason?: string;
  createdAt?: Timestamp;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: Timestamp;
}

/** The identity fields of a profile, with missing values as "". */
export function identityOf(p: Partial<Record<IdentityField, string>> | null | undefined): Identity {
  return {
    fullName: p?.fullName ?? "",
    purok: p?.purok ?? "",
    contact: p?.contact ?? "",
    birthday: p?.birthday ?? "",
    sex: p?.sex ?? "",
    civilStatus: p?.civilStatus ?? "",
  };
}

/** Which identity fields differ between two values. */
export function changedFields(from: Identity, to: Identity): IdentityField[] {
  return IDENTITY_FIELDS.filter((k) => from[k] !== to[k]);
}

/** Live view of the signed-in resident's own change request (null when there is none). */
export function useMyProfileChange(uid: string | undefined): ProfileChange | null {
  const [change, setChange] = useState<ProfileChange | null>(null);
  useEffect(() => {
    if (!uid) {
      setChange(null);
      return;
    }
    return onSnapshot(
      doc(db, "profileChanges", uid),
      (snap) => setChange(snap.exists() ? ({ id: snap.id, ...snap.data() } as ProfileChange) : null),
      (err) => console.warn("[profileChange]", err),
    );
  }, [uid]);
  return change;
}
