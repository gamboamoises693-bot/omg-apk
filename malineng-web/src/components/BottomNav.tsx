"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Store, MessagesSquare, Briefcase, UserCircle } from "lucide-react";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/tindahan", label: "Tindahan", icon: Store },
  { href: "/board", label: "Board", icon: MessagesSquare },
  { href: "/trabaho", label: "Trabaho", icon: Briefcase },
  { href: "/account", label: "Account", icon: UserCircle },
] as const;

export function BottomNav() {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]" aria-label="Main">
      <ul className="mx-auto flex max-w-3xl">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs font-semibold ${active ? "text-brand" : "text-gray-500"}`}
                aria-current={active ? "page" : undefined}
              >
                <span className={`rounded-full px-4 py-1 ${active ? "bg-brand-light" : ""}`}>
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
