"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Store, MessagesSquare, UserCircle, Phone } from "lucide-react";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/tindahan", label: "Tindahan", icon: Store },
  { href: "/emergency", label: "SOS", icon: Phone, sos: true },
  { href: "/board", label: "Board", icon: MessagesSquare },
  { href: "/account", label: "Account", icon: UserCircle },
] as const;

export function BottomNav() {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Main">
      <ul className="mx-auto grid max-w-3xl grid-cols-5 items-end">
        {NAV.map(({ href, label, icon: Icon, ...rest }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          if ("sos" in rest) {
            return (
              <li key={href} className="flex justify-center">
                <Link href={href} className="-mt-6 flex flex-col items-center gap-0.5 pb-1.5 text-[0.7rem] font-bold text-red-600" aria-label="SOS: Emergency">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-red-600 text-white shadow-lg shadow-red-600/40 active:bg-red-700">
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  {label}
                </Link>
              </li>
            );
          }
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 pb-2 pt-1.5 text-[0.7rem] font-semibold ${active ? "text-brand" : "text-gray-500"}`}
                aria-current={active ? "page" : undefined}
              >
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${active ? "bg-brand-light" : ""}`}>
                  <Icon className="h-[1.35rem] w-[1.35rem]" strokeWidth={active ? 2.4 : 2} aria-hidden />
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
