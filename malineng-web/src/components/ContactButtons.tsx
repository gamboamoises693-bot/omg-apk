"use client";

import { MessageCircle, Phone } from "lucide-react";
import { safeMessengerLink, telHref } from "@/lib/format";

/** Call + Messenger buttons used on listing cards and detail page. */
export function ContactButtons({ contact, messengerLink, size = "md" }: { contact: string; messengerLink?: string; size?: "sm" | "md" }) {
  const messenger = messengerLink ? safeMessengerLink(messengerLink) : null;
  const pad = size === "sm" ? "py-2 text-sm" : "py-3";
  return (
    <div className={`grid gap-2 ${messenger ? "grid-cols-2" : "grid-cols-1"}`}>
      {contact && (
        <a href={telHref(contact)} className={`flex items-center justify-center gap-1 rounded-xl bg-brand px-2 font-bold text-white ${pad}`} onClick={(e) => e.stopPropagation()}>
          <Phone className="h-4 w-4" /> Tawagan
        </a>
      )}
      {messenger && (
        <a href={messenger} target="_blank" rel="noopener noreferrer" className={`flex items-center justify-center gap-1 rounded-xl bg-[#0084FF] px-2 font-bold text-white ${pad}`} onClick={(e) => e.stopPropagation()}>
          <MessageCircle className="h-4 w-4" /> Messenger
        </a>
      )}
    </div>
  );
}
