import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import { isLocked } from "../lib/subscription";
import { FullLoader } from "./ui";
import { LockScreen } from "./LockScreen";
import type { Role } from "../lib/types";

const LOGIN: Record<Role, string> = {
  superadmin: "/admin/login",
  store_owner: "/owner/login",
  tindera: "/tindera/login",
};

/** Route guard by role. Wrong role -> that role's login page. */
export function RequireRole({ role }: { role: Role }) {
  const { user, role: myRole, loading } = useAuth();
  if (loading) return <FullLoader />;
  if (!user || myRole !== role) return <Navigate to={LOGIN[role]} replace />;
  return <Outlet />;
}

/** Locks tenant apps when the subscription is expired / store deactivated. */
export function RequireActiveStore({ forOwner }: { forOwner: boolean }) {
  const { store, status, loading, error } = useStore();
  if (loading) return <FullLoader text="Loading store..." />;
  if (error) return <FullLoader text={`Error: ${error}`} />;
  if (!store) return <FullLoader text="Walang store na naka-link sa account na ito." />;
  if (isLocked(status)) return <LockScreen forOwner={forOwner} />;
  return <Outlet />;
}

export function homeFor(role: Role | null): string {
  if (role === "superadmin") return "/admin";
  if (role === "store_owner") return "/owner";
  if (role === "tindera") return "/tindera";
  return "/";
}
