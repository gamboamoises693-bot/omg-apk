import { AppShell } from "../../components/AppShell";
import { AdminProvider, useAdmin } from "./AdminContext";

function Shell() {
  const { payments } = useAdmin();
  const pending = payments.filter((p) => p.status === "pending").length;
  return (
    <AppShell
      title="Super Admin"
      subtitle="Moises Gamboa · All Stores"
      nav={[
        { to: "/admin", label: "Dashboard", icon: "📈" },
        { to: "/admin/stores", label: "Stores", icon: "🏪" },
        { to: "/admin/billing", label: "Billing", icon: "💳", badge: pending },
        { to: "/admin/settings", label: "Settings", icon: "⚙️" },
      ]}
    />
  );
}

export default function AdminLayout() {
  return (
    <AdminProvider>
      <Shell />
    </AdminProvider>
  );
}
