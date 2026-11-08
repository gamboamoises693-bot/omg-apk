"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Thermometer, X } from "lucide-react";
import { useSettings } from "@/lib/useSettings";
import { classifyHeat, getHeatReport, type HeatLevel, type HeatReport } from "@/lib/heatIndex";
import { todayISO } from "@/lib/format";

const DISMISS_KEY = "malineng-heat-dismissed";

const STYLE: Record<HeatLevel, string> = {
  normal: "bg-brand-light text-brand",
  caution: "bg-yellow-300 text-yellow-950",
  "extreme-caution": "bg-orange-500 text-white",
  danger: "bg-red-600 text-white",
  "extreme-danger": "bg-red-900 text-white",
};

/**
 * Default top banner: live heat index for Cuyapo (El Niño monitoring).
 * Admin can turn it off in Settings. Hidden silently if the weather service is unreachable.
 */
export function HeatIndexBanner() {
  const { settings } = useSettings();
  const [report, setReport] = useState<HeatReport | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === todayISO());
    } catch {
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    if (!settings.showHeatIndex) return;
    let alive = true;
    const load = () => getHeatReport().then((r) => alive && r && setReport(r));
    void load();
    const timer = setInterval(load, 30 * 60 * 1000); // refresh every 30 minutes
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [settings.showHeatIndex]);

  if (!settings.showHeatIndex || !report || dismissed) return null;

  const now = classifyHeat(report.now);
  const peak = classifyHeat(report.maxToday);
  // Colour by the worse of "now" and "today's peak", so people prepare early.
  const shown = report.maxToday > report.now ? peak : now;

  return (
    <div className={`no-print ${STYLE[shown.level]}`} role="status" aria-live="polite">
      <div className="mx-auto max-w-3xl px-4 py-2">
        <div className="flex items-center gap-2">
          <Thermometer className="h-5 w-5 shrink-0" aria-hidden />
          <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-1 text-left text-[0.85rem]" aria-expanded={open}>
            <span className="truncate">
              <b>Heat Index {report.now}°C</b> · {now.label}
              {report.maxToday > report.now && <> · Pinakamataas ngayon: <b>{report.maxToday}°C</b>{report.maxHour ? ` (${report.maxHour})` : ""}</>}
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
          <button
            onClick={() => {
              setDismissed(true);
              try {
                localStorage.setItem(DISMISS_KEY, todayISO());
              } catch {
                /* ignore */
              }
            }}
            className="rounded-full p-1 opacity-80 active:bg-black/10"
            aria-label="Itago ngayong araw"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {open && (
          <div className="mt-1.5 space-y-1 pb-1 pl-7 text-[0.8rem]">
            <p>🌡️ Temperatura: {report.tempNow}°C · Ramdam na init (heat index): {report.now}°C</p>
            {report.maxToday > report.now && (
              <p>📈 Pinakamataas ngayong araw: <b>{report.maxToday}°C</b>{report.maxHour ? ` bandang ${report.maxHour}` : ""} ({peak.label})</p>
            )}
            <p>💡 {shown.advice}</p>
            <p className="opacity-80">Cuyapo, Nueva Ecija · Ina-update bawat 30 minuto · Batay sa PAGASA heat index classification</p>
          </div>
        )}
      </div>
    </div>
  );
}
