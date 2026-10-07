import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { watchConfig, watchStore, DEFAULT_CONFIG } from "../services/stores";
import { watchTindera } from "../services/tinderas";
import { getSubStatus, daysLeft } from "../lib/subscription";
import { toDate } from "../lib/dates";
import type { AppConfig, Store, SubStatus, Tindera } from "../lib/types";

interface StoreState {
  store: Store | null;
  /** Logged-in tindera's own profile (null for owners). */
  me: Tindera | null;
  status: SubStatus;
  daysLeft: number;
  config: AppConfig;
  loading: boolean;
  error: string | null;
}

const StoreCtx = createContext<StoreState | null>(null);

/** Subscribes to the signed-in user's own store (tenant) + subscription status. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [me, setMe] = useState<Tindera | null>(null);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Re-evaluate status every minute so the lock screen appears without a reload.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => watchConfig(setConfig), []);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    const unsubs = [
      watchStore(
        profile.store_id,
        (s) => {
          setStore(s);
          setLoading(false);
        },
        (e) => {
          setError(e.message);
          setLoading(false);
        },
      ),
    ];
    if (profile.role === "tindera") {
      unsubs.push(watchTindera(profile.store_id, profile.uid, setMe, (e) => setError(e.message)));
    }
    return () => unsubs.forEach((u) => u());
  }, [profile]);

  const value = useMemo<StoreState>(() => {
    const dates = store
      ? { trial_end: toDate(store.trial_end) ?? new Date(0), subscription_end: toDate(store.subscription_end), deactivated: store.deactivated }
      : null;
    return {
      store,
      me,
      status: dates ? getSubStatus(dates, now) : "expired",
      daysLeft: dates ? daysLeft(dates, now) : 0,
      config,
      loading,
      error,
    };
  }, [store, me, config, loading, error, now]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreState {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
