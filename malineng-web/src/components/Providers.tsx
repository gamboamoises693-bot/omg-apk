"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/lib/i18n";
import { AdminPendingProvider } from "@/context/AdminPendingContext";
import { ToastProvider } from "./Toast";
import { AdminAlertWatcher } from "./admin/AdminAlertWatcher";
import { ListingHousekeeping } from "./admin/ListingHousekeeping";
import { isFirebaseConfigured } from "@/lib/firebase";
import { PresenceBeat } from "@/lib/presence";
import { VisitTracker } from "@/lib/visits";
import { PabatidWatcher } from "./PabatidBell";
import { BoardNotifier } from "./BoardNotifier";
import { RaffleEntryManager } from "./RaffleEntryManager";
import { DonationNotifier } from "./DonationNotifier";
import { RegisterServiceWorker } from "./InstallApp";
import { XmasMusic } from "./XmasMusic";
import { OfficerLanding } from "./OfficerLanding";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
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
          <VisitTracker />
          <PabatidWatcher />
          <BoardNotifier />
          <RaffleEntryManager />
          <DonationNotifier />
          <XmasMusic />
          <OfficerLanding />
          <AdminAlertWatcher />
          <ListingHousekeeping />
          {children}
        </ToastProvider>
      </AdminPendingProvider>
    </AuthProvider>
    </LanguageProvider>
  );
}
