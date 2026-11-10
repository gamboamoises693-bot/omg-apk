"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, getDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { UserProfile, Verification } from "@/lib/types";
import { setActivityActor } from "@/lib/activity";
import { PHONE_TAKEN_MESSAGE, claimPhoneInBatch, normalizePhone, phoneOwner } from "@/lib/phone";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  /** Admin or Super Admin (full admin powers; a BHW is not included). */
  isAdmin: boolean;
  /** Any staff account: admins, Super Admin and BHW. */
  isStaff: boolean;
  /** Can manage the Botika: BHW, BHW Head, Kapitan or Super Admin. */
  canBotika: boolean;
  /** Approves Hiraman (borrowing) requests: Kapitan, Secretary or Super Admin. */
  canBorrowAdmin: boolean;
  /** Officers (Kapitan, Secretary, Super Admin): Pabatid, Survey, Transparency. */
  isOfficer: boolean;
  isSuperAdmin: boolean;
  /** Can approve ambulance trips: Kapitan or Super Admin. */
  isKapitan: boolean;
  /** Selfie approved (admins always count as verified). */
  isVerified: boolean;
  isSuspended: boolean;
  /** The user's own selfie verification record, if submitted. */
  verification: Verification | null;
  /** true when logged in but required profile fields are still empty (e.g. new Google user). */
  needsProfile: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Creates users/{uid} with role "resident" if it does not exist yet.
 * Called after register and after Google login.
 */
export async function ensureUserDoc(user: User, extra?: Partial<UserProfile>): Promise<void> {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) return;
  // One number = one account: the number is claimed in the same batch as the profile.
  const contact = normalizePhone(extra?.contact ?? "");
  if (contact && (await phoneOwner(contact, user.uid)) === "taken") throw new Error(PHONE_TAKEN_MESSAGE);
  const batch = writeBatch(db);
  batch.set(userRef, {
    uid: user.uid,
    fullName: extra?.fullName || user.displayName || "Residente",
    purok: extra?.purok ?? "",
    contact,
    birthday: extra?.birthday ?? "",
    email: user.email ?? "",
    role: "resident",
    createdAt: serverTimestamp(),
  });
  if (contact) claimPhoneInBatch(batch, contact, user.uid);
  await batch.commit();
}

/**
 * Accounts made before the one-number rule: claim their number once, if nobody else has.
 * (If someone already holds it, the Super Admin sees both in "Posibleng Doble".)
 */
const backfilled = new Set<string>();
async function backfillPhone(uid: string, contact: string): Promise<void> {
  const phone = normalizePhone(contact);
  if (!phone || phone !== contact || backfilled.has(uid)) return;
  backfilled.add(uid);
  try {
    if ((await phoneOwner(phone, uid)) !== "free") return;
    const batch = writeBatch(db);
    claimPhoneInBatch(batch, phone, uid);
    await batch.commit();
  } catch (err) {
    console.warn("[phone] backfill skipped:", err);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifiedFlag, setVerifiedFlag] = useState(false);
  const [verification, setVerification] = useState<Verification | null>(null);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    let unsubVerified: (() => void) | undefined;
    let unsubVerification: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubProfile?.();
      unsubVerified?.();
      unsubVerification?.();
      setUser(firebaseUser);

      if (!firebaseUser) {
        setProfile(null);
        setVerifiedFlag(false);
        setVerification(null);
        setLoading(false);
        return;
      }

      // Verified badge flag (public) + own selfie record (private) — both live.
      unsubVerified = onSnapshot(
        doc(db, "verifiedUsers", firebaseUser.uid),
        (snap) => setVerifiedFlag(snap.exists()),
        () => setVerifiedFlag(false),
      );
      unsubVerification = onSnapshot(
        doc(db, "verifications", firebaseUser.uid),
        (snap) => setVerification(snap.exists() ? ({ id: snap.id, ...snap.data() } as Verification) : null),
        () => setVerification(null),
      );

      // Live profile so role changes (e.g. promoted to admin) apply immediately.
      unsubProfile = onSnapshot(
        doc(db, "users", firebaseUser.uid),
        (snap) => {
          const p = snap.exists() ? ({ uid: snap.id, ...snap.data() } as UserProfile) : null;
          setProfile(p);
          setLoading(false);
          if (p?.contact) void backfillPhone(snap.id, p.contact);
        },
        (err) => {
          console.error("[auth] profile listener error:", err);
          setProfile(null);
          setLoading(false);
        },
      );
    });

    return () => {
      unsubProfile?.();
      unsubVerified?.();
      unsubVerification?.();
      unsubAuth();
    };
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  // Register who is acting, for one-line logActivity() calls everywhere.
  useEffect(() => {
    setActivityActor(user && profile ? { uid: user.uid, name: profile.fullName, role: profile.position ? `${profile.role}:${profile.position}` : profile.role } : null);
  }, [user, profile]);

  const value = useMemo<AuthContextValue>(() => {
    const isSuperAdmin = profile?.role === "superadmin";
    const isStaff = isSuperAdmin || profile?.role === "admin";
    const isBhw = profile?.role === "admin" && (profile?.position === "BHW" || profile?.position === "BHW Head");
    const isAdmin = isStaff && !isBhw;
    return {
      user,
      profile,
      loading,
      isAdmin,
      isStaff,
      canBotika: isSuperAdmin || isBhw || (isAdmin && profile?.position === "Kapitan"),
      canBorrowAdmin: isSuperAdmin || (isAdmin && (profile?.position === "Kapitan" || profile?.position === "Secretary")),
      isOfficer: isSuperAdmin || (isAdmin && (profile?.position === "Kapitan" || profile?.position === "Secretary")),
      isSuperAdmin,
      isKapitan: isSuperAdmin || (isAdmin && profile?.position === "Kapitan"),
      isVerified: isStaff || verifiedFlag,
      isSuspended: profile?.suspended === true,
      verification,
      needsProfile: !!user && !!profile && (!profile.purok || !profile.contact),
      logout,
    };
  }, [user, profile, loading, verifiedFlag, verification, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
