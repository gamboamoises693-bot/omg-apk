"use client";

import { useEffect, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import { Button, Card } from "@/components/ui";

/** Chrome / Samsung Internet fire this when the site can be installed. It is not in the TypeScript DOM types. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "malineng.installDismissedAt";
const DISMISS_DAYS = 14;

/** Register the (non-caching) service worker for everyone: browsers only offer "Install app" when one exists. */
export function RegisterServiceWorker(): null {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || window.location.hostname === "localhost") return;
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("[sw] register failed:", err));
  }, []);
  return null;
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Install prompt event, shared by every InstallApp on the page. */
function useInstallState() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep it for our own button
      setEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") setInstalled(true);
    setEvent(null); // the event can only be used once
  };
  return { event, installed, install };
}

function manualSteps(): { title: string; steps: string[] } {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return { title: "Sa iPhone (Safari)", steps: ["Pindutin ang Share (kahon na may arrow pataas).", "Piliin ang “Add to Home Screen”.", "Pindutin ang “Add”."] };
  if (/SamsungBrowser/i.test(ua)) return { title: "Sa Samsung Internet", steps: ["Pindutin ang ☰ (menu) sa ibaba.", "Piliin ang “Add page to” → “Home screen”.", "Kung may “Install app” sa menu, iyon ang piliin."] };
  return { title: "Sa Chrome", steps: ["Pindutin ang ⋮ (tatlong tuldok) sa itaas.", "Piliin ang “Install app” o “Add to Home screen”.", "Pindutin ang “Install”."] };
}

/** Account page: always available, with a button when the browser allows it and written steps when it does not. */
export function InstallAppCard() {
  const { event, installed, install } = useInstallState();
  const [steps, setSteps] = useState<ReturnType<typeof manualSteps> | null>(null);
  useEffect(() => setSteps(manualSteps()), []);

  return (
    <Card className="space-y-2">
      {installed ? (
        <p className="text-sm font-semibold text-emerald-700">✓ Naka-install na ang app sa phone na ito.</p>
      ) : (
        <>
          <p className="text-sm text-gray-700">Ilagay ang Barangay Malineng sa Home screen ng phone mo para mabilis buksan, parang totoong app.</p>
          {event ? (
            <Button full onClick={install}><Download className="h-4 w-4" /> I-install ang app</Button>
          ) : (
            steps && (
              <div className="rounded-xl bg-gray-50 p-3 text-sm">
                <p className="mb-1 flex items-center gap-1.5 font-bold"><Share2 className="h-4 w-4 text-brand" /> {steps.title}</p>
                <ol className="list-decimal space-y-0.5 pl-5 text-gray-700">{steps.steps.map((s) => <li key={s}>{s}</li>)}</ol>
              </div>
            )
          )}
        </>
      )}
    </Card>
  );
}

/** Home page: a small, dismissible card, shown only when the browser really can install the app. */
export function InstallBanner() {
  const { event, installed, install } = useInstallState();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      setHidden(!!at && Date.now() - at < DISMISS_DAYS * 86_400_000);
    } catch {
      setHidden(false);
    }
  }, []);

  if (!event || installed || hidden) return null;
  return (
    <section className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand"><Download className="h-5 w-5" aria-hidden /></span>
      <p className="min-w-0 flex-1 text-sm"><b>I-install ang app</b> para mabilis buksan mula sa Home screen.</p>
      <Button className="!min-h-0 !px-3 !py-2 text-sm" onClick={install}>I-install</Button>
      <button
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
          } catch {
            /* private mode: it simply shows again next time */
          }
          setHidden(true);
        }}
        className="rounded-full p-1 text-gray-400 active:bg-gray-100"
        aria-label="Isara"
      >
        <X className="h-4 w-4" />
      </button>
    </section>
  );
}
