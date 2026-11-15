"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Music, VolumeX } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useXmasMusicAllowed } from "@/lib/theme";
import { isPlaying, startMusic, stopMusic } from "@/lib/xmasMusic";

const KEY = "malineng-xmas-music";

/** Places where music would be in the way (emergencies, the driver's link, the admin screens). */
const QUIET = ["/admin", "/emergency", "/ambulansya", "/driver"];

/**
 * Soft Christmas music while the Christmas look is on, and a small button to switch it off (or on) on this phone.
 * - The Developer can turn it off for everyone in Admin → Settings → Tema ng Pasko.
 * - The browser only allows sound after a tap, so it starts with the person's first touch of the screen.
 * - It pauses when the tab is hidden, while a video plays, and on emergency and admin pages.
 */
export function XmasMusic() {
  const allowed = useXmasMusicAllowed();
  const pathname = usePathname() ?? "/";
  const { lang } = useLang();
  const [wanted, setWanted] = useState(true); // this phone's choice (remembered)
  const [playing, setPlaying] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [video, setVideo] = useState(false);
  const unlocked = useRef(false);

  const quiet = QUIET.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const should = allowed && wanted && !quiet && !hidden && !video;

  // Remember the choice made on this phone.
  useEffect(() => {
    try {
      setWanted(localStorage.getItem(KEY) !== "off");
    } catch {
      /* storage blocked: music stays on until the tab closes */
    }
  }, []);

  useEffect(() => {
    const vis = () => setHidden(document.hidden);
    const on = (e: Event) => e.target instanceof HTMLMediaElement && setVideo(true);
    const off = (e: Event) => e.target instanceof HTMLMediaElement && setVideo(false);
    document.addEventListener("visibilitychange", vis);
    document.addEventListener("play", on, true);
    document.addEventListener("pause", off, true);
    document.addEventListener("ended", off, true);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      document.removeEventListener("play", on, true);
      document.removeEventListener("pause", off, true);
      document.removeEventListener("ended", off, true);
    };
  }, []);

  // Start with the first touch (browsers need it); once unlocked, later starts need no touch.
  useEffect(() => {
    if (!should) {
      if (isPlaying()) stopMusic();
      setPlaying(false);
      return;
    }
    if (unlocked.current) {
      setPlaying(startMusic());
      return;
    }
    const first = (e: Event) => {
      // A tap on the music button itself is handled by the button.
      if (e.target instanceof Element && e.target.closest("[data-xmas-music]")) return;
      if (startMusic()) {
        unlocked.current = true;
        setPlaying(true);
      }
    };
    window.addEventListener("pointerdown", first, { once: true });
    window.addEventListener("keydown", first, { once: true });
    return () => {
      window.removeEventListener("pointerdown", first);
      window.removeEventListener("keydown", first);
    };
  }, [should]);

  // Stop the sound when the app is closed.
  useEffect(() => () => stopMusic(), []);

  const toggle = useCallback(() => {
    // Sound on and playing: switch it off. Anything else (off, or on but waiting for the first touch): switch it on and play.
    const turnOn = !(wanted && playing);
    setWanted(turnOn);
    try {
      localStorage.setItem(KEY, turnOn ? "on" : "off");
    } catch {
      /* storage blocked */
    }
    if (turnOn && allowed && !quiet) {
      // This tap is the touch the browser needs.
      if (startMusic()) {
        unlocked.current = true;
        setPlaying(true);
      }
    } else {
      stopMusic();
      setPlaying(false);
    }
  }, [wanted, playing, allowed, quiet]);

  if (!allowed || quiet) return null;
  const on = wanted;
  const label = on ? (lang === "en" ? "Turn off Christmas music" : "Patayin ang Pasko music") : lang === "en" ? "Turn on Christmas music" : "Buksan ang Pasko music";
  return (
    <button
      type="button"
      data-xmas-music
      onClick={toggle}
      aria-label={label}
      aria-pressed={on}
      title={label}
      className={`no-print fixed bottom-[5.4rem] left-3 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-white/40 text-white shadow-lg active:scale-95 ${on ? "bg-[#B3202B]" : "bg-gray-500"}`}
    >
      {on ? <Music className={`h-5 w-5 ${playing ? "motion-safe:animate-pulse" : ""}`} aria-hidden /> : <VolumeX className="h-5 w-5" aria-hidden />}
    </button>
  );
}
