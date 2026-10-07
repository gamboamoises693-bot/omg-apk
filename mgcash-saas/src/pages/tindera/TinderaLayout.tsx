import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AppShell } from "../../components/AppShell";
import { useStore } from "../../context/StoreContext";
import { watchOpenShift } from "../../services/shifts";
import { FullLoader } from "../../components/ui";
import type { Shift } from "../../lib/types";

const ShiftCtx = createContext<Shift | null>(null);
export const useShift = () => useContext(ShiftCtx);

/** Tindera shell. Every page except Start Shift / Commission requires an open shift. */
export default function TinderaLayout() {
  const { store, me } = useStore();
  const [shift, setShift] = useState<Shift | null | undefined>(undefined);
  const loc = useLocation();

  useEffect(() => (store && me ? watchOpenShift(store.id, me.id, setShift) : undefined), [store, me]);

  if (!store || !me || shift === undefined) return <FullLoader text="Loading shift..." />;
  if (!me.active) return <FullLoader text="Naka-disable ang account mo. Kausapin si Boss." />;

  // End Shift stays reachable after closing so the audit result can be shown.
  const free = ["/tindera/start", "/tindera/commission", "/tindera/end"];
  if (!shift && !free.includes(loc.pathname)) return <Navigate to="/tindera/start" replace />;

  return (
    <ShiftCtx.Provider value={shift}>
      <AppShell
        title="Tindera"
        subtitle={`${me.name} · ${store.store_name}`}
        nav={
          shift
            ? [
                { to: "/tindera", label: "Home", icon: "🏠" },
                { to: "/tindera/cash-in", label: "Cash In", icon: "⬇️" },
                { to: "/tindera/cash-out", label: "Cash Out", icon: "⬆️" },
                { to: "/tindera/load", label: "Load", icon: "📱" },
                { to: "/tindera/commission", label: "Commission", icon: "💰" },
                { to: "/tindera/end", label: "End Shift", icon: "🔚" },
              ]
            : [
                { to: "/tindera/start", label: "Start Shift", icon: "▶️" },
                { to: "/tindera/commission", label: "Commission", icon: "💰" },
              ]
        }
      />
    </ShiftCtx.Provider>
  );
}

