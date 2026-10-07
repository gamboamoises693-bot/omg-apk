import { useEffect, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { SubscriptionBanner } from "../../components/SubscriptionBanner";
import { useStore } from "../../context/StoreContext";
import { watchPending } from "../../services/transactions";

export default function OwnerLayout() {
  const { store } = useStore();
  const [pending, setPending] = useState(0);

  useEffect(() => (store ? watchPending(store.id, (t) => setPending(t.length)) : undefined), [store]);

  return (
    <AppShell
      title="Boss"
      subtitle={store ? `${store.store_name} · Code ${store.store_code}` : undefined}
      top={<SubscriptionBanner />}
      nav={[
        { to: "/owner", label: "Home", icon: "🏠" },
        { to: "/owner/approvals", label: "Approvals", icon: "✅", badge: pending },
        { to: "/owner/tinderas", label: "Tindera", icon: "👩" },
        { to: "/owner/audit", label: "Audit", icon: "🧾" },
        { to: "/owner/payroll", label: "Payroll", icon: "💵" },
        { to: "/owner/reports", label: "Reports", icon: "📊" },
        { to: "/owner/settings", label: "Settings", icon: "⚙️" },
      ]}
    />
  );
}
