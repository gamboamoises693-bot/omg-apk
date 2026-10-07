import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { Role, UserProfile } from "../lib/types";

interface AuthState {
  user: User | null;
  role: Role | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
  /** Re-read role/profile (e.g. right after sign-up writes the users doc). */
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

async function resolveRole(user: User): Promise<{ role: Role | null; profile: UserProfile | null }> {
  // Super Admin is a custom claim (cannot be self-assigned from the client).
  const token = await user.getIdTokenResult();
  if (token.claims.superadmin === true) return { role: "superadmin", profile: null };

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return { role: null, profile: null };
  const d = snap.data();
  const profile: UserProfile = {
    uid: user.uid,
    role: d.role,
    store_id: d.store_id,
    name: d.name ?? "",
    phone: d.phone,
    username: d.username,
  };
  return { role: profile.role, profile };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sequence guard: only the latest load() may set state (sign-up fires auth change
  // before the users doc exists, then refresh() runs again after it is written).
  const seq = useRef(0);

  const load = async (u: User | null) => {
    const mine = ++seq.current;
    setUser(u);
    if (!u) {
      setRole(null);
      setProfile(null);
      setLoading(false);
      return;
    }
    try {
      const r = await resolveRole(u);
      if (mine !== seq.current) return;
      setRole(r.role);
      setProfile(r.profile);
      setError(null);
    } catch (e) {
      if (mine === seq.current) setError((e as Error).message);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  };

  useEffect(() => onAuthStateChanged(auth, (u) => void load(u)), []);

  const value: AuthState = {
    user,
    role,
    profile,
    loading,
    error,
    logout: () => signOut(auth),
    refresh: () => load(auth.currentUser),
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
