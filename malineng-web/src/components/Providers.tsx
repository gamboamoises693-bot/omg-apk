"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { AdminPendingProvider } from "@/context/AdminPendingContext";
import { ToastProvider } from "./Toast";
import { AdminAlertWatcher } from "./admin/AdminAlertWatcher";
import { ListingHousekeeping } from "./admin/ListingHousekeeping";
import { isFirebaseConfigured } from "@/lib/firebase";
import { PresenceBeat } from "@/lib/presence";
import { PabatidWatcher } from "./PabatidBell";
import { BoardNotifier } from "./BoardNotifier";
import { RegisterServiceWorker } from "./InstallApp";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {/* One set of "pending approval" listeners for admins: badges + phone alerts. */}
      <AdminPendingProvider>
        <ToastProvider>
          {!isFirebaseConfigured && (
            <div className="bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white">
              Hindi pa naka-set ang Firebase config. I-edit ang src/config/firebase.config.ts
            </div>
          )}
          <RegisterServiceWorker />
          <PresenceBeat />
          <PabatidWatcher />
          <BoardNotifier />
          <AdminAlertWatcher />
          <ListingHousekeeping />
          {children}
        </ToastProvider>
      </AdminPendingProvider>
    </AuthProvider>
  );
}
