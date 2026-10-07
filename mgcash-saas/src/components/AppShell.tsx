import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { ReactNode } from "react";

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  badge?: number;
}

/** Mobile-first shell: blue header + bottom tab bar (scrolls horizontally if many tabs). */
export function AppShell({ title, subtitle, nav, top }: { title: string; subtitle?: string; nav: NavItem[]; top?: ReactNode }) {
  const { logout } = useAuth();
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
      <header className="sticky top-0 z-30 bg-brand px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white shadow">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="truncate text-lg font-black tracking-tight">
              MG<span className="text-accent">-CASH</span> <span className="font-semibold text-white/80">· {title}</span>
            </div>
            {subtitle ? <div className="truncate text-xs text-white/70">{subtitle}</div> : null}
          </div>
          <button onClick={() => void logout()} className="rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold">
            Logout
          </button>
        </div>
      </header>
      {top}
      <main className="flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-5xl overflow-x-auto">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end
              className={({ isActive }) =>
                `relative flex min-w-[4.5rem] flex-1 flex-col items-center gap-0.5 px-2 py-2 text-[11px] font-semibold ${
                  isActive ? "text-brand" : "text-slate-500"
                }`
              }
            >
              <span className="text-xl leading-none">{n.icon}</span>
              {n.label}
              {n.badge ? (
                <span className="absolute right-2 top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{n.badge}</span>
              ) : null}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
