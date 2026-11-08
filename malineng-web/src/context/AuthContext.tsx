"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { UserProfile, Verification } from "@/lib/types";
import { setActivityActor } from "@/lib/activity";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  /** Admin or Super Admin. */
  isAdmin: boolean;
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
  await setDoc(userRef, {
    uid: user.uid,
    fullName: extra?.fullName || user.displayName || "Residente",
    purok: extra?.purok ?? "",
    contact: extra?.contact ?? "",
    birthday: extra?.birthday ?? "",
    email: user.email ?? "",
    role: "resident",
    createdAt: serverTimestamp(),
  });
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
          setProfile(snap.exists() ? ({ uid: snap.id, ...snap.data() } as UserProfile) : null);
          setLoading(false);
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
    const isAdmin = isSuperAdmin || profile?.role === "admin";
    return {
      user,
      profile,
      loading,
      isAdmin,
      isSuperAdmin,
      isKapitan: isSuperAdmin || (isAdmin && profile?.position === "Kapitan"),
      isVerified: isAdmin || verifiedFlag,
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
