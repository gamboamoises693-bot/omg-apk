/**
 * Heat index for Cuyapo, Nueva Ecija (El Niño monitoring).
 * Weather: Open-Meteo (free, no API key). Formula: NOAA/Rothfusz heat index, the same basis PAGASA uses.
 * Levels follow PAGASA's heat index classification.
 */

export const CUYAPO = { lat: 15.78, lon: 120.66 };

export type HeatLevel = "normal" | "caution" | "extreme-caution" | "danger" | "extreme-danger";

export interface HeatLevelInfo {
  level: HeatLevel;
  label: string;
  advice: string;
}

/** PAGASA heat index classification (°C). */
export function classifyHeat(hiC: number): HeatLevelInfo {
  if (hiC >= 52) return { level: "extreme-danger", label: "Extreme Danger", advice: "Delikado ang heat stroke. Manatili sa loob ng bahay, uminom ng maraming tubig." };
  if (hiC >= 42) return { level: "danger", label: "Danger", advice: "Posible ang heat cramps at heat exhaustion. Iwasan ang araw mula 10AM hanggang 4PM." };
  if (hiC >= 33) return { level: "extreme-caution", label: "Extreme Caution", advice: "Uminom ng tubig kahit hindi nauuhaw. Bantayan ang mga bata at senior." };
  if (hiC >= 27) return { level: "caution", label: "Caution", advice: "Mag-ingat sa matagal na pagbibilad sa araw." };
  return { level: "normal", label: "Normal", advice: "Komportable ang init ngayon." };
}

/** NOAA heat index (Rothfusz regression with adjustments). Input/output in °C, RH in %. */
export function heatIndexC(tempC: number, rh: number): number {
  const T = tempC * 9 / 5 + 32;
  let hi = 0.5 * (T + 61 + (T - 68) * 1.2 + rh * 0.094);
  if ((hi + T) / 2 >= 80) {
    hi =
      -42.379 + 2.04901523 * T + 10.14333127 * rh - 0.22475541 * T * rh - 0.00683783 * T * T - 0.05481717 * rh * rh +
      0.00122874 * T * T * rh + 0.00085282 * T * rh * rh - 0.00000199 * T * T * rh * rh;
    if (rh < 13 && T >= 80 && T <= 112) hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    else if (rh > 85 && T >= 80 && T <= 87) hi += ((rh - 85) / 10) * ((87 - T) / 5);
  }
  return Math.round(((hi - 32) * 5) / 9);
}

export interface HeatReport {
  now: number; // °C heat index right now
  tempNow: number; // °C air temperature
  maxToday: number; // highest forecast heat index today
  maxHour: string; // e.g. "1 PM"
  fetchedAt: number;
}

const CACHE_KEY = "malineng-heat-index";
const CACHE_MS = 30 * 60 * 1000;

function hourLabel(iso: string): string {
  const h = Number(iso.slice(11, 13));
  return `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? "PM" : "AM"}`;
}

/** Fetches (or reads a 30-minute cache of) today's heat index for Cuyapo. Returns null on any failure. */
export async function getHeatReport(): Promise<HeatReport | null> {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "null") as HeatReport | null;
    if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached;
  } catch {
    /* no cache */
  }
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${CUYAPO.lat}&longitude=${CUYAPO.lon}` +
      "&current=temperature_2m,relative_humidity_2m&hourly=temperature_2m,relative_humidity_2m&timezone=Asia%2FManila&forecast_days=1";
    const res = await fetch(url);
    if (!res.ok) return null;
    const d = await res.json();
    const tempNow = Number(d.current?.temperature_2m);
    const rhNow = Number(d.current?.relative_humidity_2m);
    if (!Number.isFinite(tempNow) || !Number.isFinite(rhNow)) return null;

    const times: string[] = d.hourly?.time ?? [];
    const temps: number[] = d.hourly?.temperature_2m ?? [];
    const rhs: number[] = d.hourly?.relative_humidity_2m ?? [];
    let maxToday = heatIndexC(tempNow, rhNow);
    let maxHour = "";
    times.forEach((t, i) => {
      const hi = heatIndexC(temps[i], rhs[i]);
      if (Number.isFinite(hi) && hi > maxToday) {
        maxToday = hi;
        maxHour = hourLabel(t);
      }
    });

    const report: HeatReport = { now: heatIndexC(tempNow, rhNow), tempNow: Math.round(tempNow), maxToday, maxHour, fetchedAt: Date.now() };
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(report));
    } catch {
      /* ignore */
    }
    return report;
  } catch {
    return null;
  }
}
