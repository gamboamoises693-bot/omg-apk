import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { watchAllStores, watchConfig, DEFAULT_CONFIG } from "../../services/stores";
import { watchAllPayments } from "../../services/payments";
import { getSubStatus } from "../../lib/subscription";
import { toDate } from "../../lib/dates";
import type { AppConfig, Payment, Store, SubStatus } from "../../lib/types";

export interface StoreRow extends Store {
  status: SubStatus;
}

interface AdminState {
  stores: StoreRow[];
  payments: Payment[];
  config: AppConfig;
  loading: boolean;
  error: string | null;
}

const Ctx = createContext<AdminState | null>(null);

export function statusOf(s: Store, now = new Date()): SubStatus {
  return getSubStatus({ trial_end: toDate(s.trial_end) ?? new Date(0), subscription_end: toDate(s.subscription_end), deactivated: s.deactivated }, now);
}

/** Live feed of all stores + payments for the Super Admin screens. */
export function AdminProvider({ children }: { children: ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u = [
      watchAllStores(
        (s) => {
          setStores(s);
          setLoading(false);
        },
        (e) => {
          setError(e.message);
          setLoading(false);
        },
      ),
      watchAllPayments(setPayments, (e) => setError(e.message)),
      watchConfig(setConfig),
    ];
    return () => u.forEach((x) => x());
  }, []);

  const value = useMemo<AdminState>(() => {
    const now = new Date();
    return { stores: stores.map((s) => ({ ...s, status: statusOf(s, now) })), payments, config, loading, error };
  }, [stores, payments, config, loading, error]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin(): AdminState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin must be used inside <AdminProvider>");
  return c;
}
