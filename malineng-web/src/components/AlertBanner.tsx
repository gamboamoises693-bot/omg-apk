"use client";

import { useEffect, useState } from "react";
import { CloudRain, Waves, ZapOff, Megaphone, X } from "lucide-react";
import { useSettings } from "@/lib/useSettings";

const STORAGE_KEY = "malineng-dismissed-alert";

const ALERT_STYLE = {
  baha: { icon: Waves, cls: "bg-blue-700 text-white", label: "BAHA" },
  brownout: { icon: ZapOff, cls: "bg-gray-800 text-white", label: "BROWNOUT" },
  weather: { icon: CloudRain, cls: "bg-orange-600 text-white", label: "WEATHER" },
  wala: { icon: Megaphone, cls: "bg-gold text-brand-dark", label: "PAALALA" },
} as const;

/** Top alert from settings.alertBanner. Dismissal is remembered per alert text. */
export function AlertBanner() {
  const { settings } = useSettings();
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY));
    } catch {
      /* storage blocked: banner just shows again */
    }
  }, []);

  const text = settings.alertBanner?.trim();
  if (!text || dismissed === text) return null;

  const style = ALERT_STYLE[settings.alertType] ?? ALERT_STYLE.wala;
  const Icon = style.icon;

  return (
    <div className={`no-print ${style.cls} px-4 py-3`} role="alert">
      <div className="mx-auto flex max-w-3xl items-start gap-3">
        <Icon className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
        <p className="flex-1 font-semibold">
          <span className="mr-1 font-extrabold">{style.label}:</span>
          {text}
        </p>
        <button
          onClick={() => {
            setDismissed(text);
            try {
              localStorage.setItem(STORAGE_KEY, text);
            } catch {
              /* ignore */
            }
          }}
          className="rounded-full p-1 active:bg-black/10"
          aria-label="Isara ang alert"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
