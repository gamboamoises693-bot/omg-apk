"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "./Toast";
import { AmbulanceAlertWatcher } from "./admin/AmbulanceAlertWatcher";
import { ListingHousekeeping } from "./admin/ListingHousekeeping";
import { isFirebaseConfigured } from "@/lib/firebase";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        {!isFirebaseConfigured && (
          <div className="bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white">
            Hindi pa naka-set ang Firebase config. I-edit ang src/config/firebase.config.ts
          </div>
        )}
        <AmbulanceAlertWatcher />
        <ListingHousekeeping />
        {children}
      </ToastProvider>
    </AuthProvider>
  );
}
