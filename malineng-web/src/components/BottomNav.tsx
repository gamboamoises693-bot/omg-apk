"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, MessagesSquare, UserCircle, Phone } from "lucide-react";
import { useChatUnread } from "@/lib/useChatUnread";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/emergency", label: "SOS", icon: Phone, sos: true },
  { href: "/board", label: "Board", icon: MessagesSquare },
  { href: "/account", label: "Account", icon: UserCircle },
] as const;

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const unread = useChatUnread();

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Main">
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
                  <span className="relative">
                    <Icon className="h-[1.35rem] w-[1.35rem]" strokeWidth={active ? 2.4 : 2} aria-hidden />
                    {href === "/chat" && unread > 0 && !active && (
                      <span className="absolute -right-2.5 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[0.6rem] font-black leading-none text-white ring-2 ring-white" aria-label={`${unread} bagong chat`}>
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </span>
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
