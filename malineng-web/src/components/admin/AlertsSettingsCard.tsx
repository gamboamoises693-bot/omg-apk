"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, BellOff, Volume2, Sun } from "lucide-react";
import {
  ALERTS_EVENT,
  getAlertsEnabled,
  notificationPermission,
  playAlertSound,
  registerServiceWorker,
  requestNotificationPermission,
  setAlertsEnabled,
  showSystemNotification,
  unlockAudio,
  vibrate,
  type PermissionState,
} from "@/lib/alerts";
import { Button, Card } from "@/components/ui";

type WakeLockSentinelLike = { release: () => Promise<void> };

/** Per-device switch for ambulance alerts (notification + sound) and optional screen wake lock. */
export function AlertsSettingsCard() {
  const [enabled, setEnabled] = useState(false);
  const [perm, setPerm] = useState<PermissionState>("default");
  const [awake, setAwake] = useState(false);
  const lock = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    const sync = () => {
      setEnabled(getAlertsEnabled());
      setPerm(notificationPermission());
    };
    sync();
    window.addEventListener(ALERTS_EVENT, sync);
    return () => window.removeEventListener(ALERTS_EVENT, sync);
  }, []);

  const turnOn = async () => {
    await unlockAudio(); // must happen inside the tap
    await registerServiceWorker();
    const result = await requestNotificationPermission();
    setPerm(result);
    setAlertsEnabled(true); // sound + in-app banner work even if notifications are denied
    playAlertSound("schedule");
    vibrate("schedule");
  };

  const test = async (kind: "emergency" | "schedule") => {
    await unlockAudio();
    playAlertSound(kind);
    vibrate(kind);
    await showSystemNotification(kind === "emergency" ? "🚨 TEST: Emergency" : "🚑 TEST: Schedule request", "Ganito ang lalabas kapag may bagong request.", kind, `test-${kind}`);
  };

  // Screen wake lock: keeps a phone at the barangay hall awake to hear alerts.
  const requestWake = async () => {
    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> } }).wakeLock;
      if (!wl) return false;
      lock.current = await wl.request("screen");
      return true;
    } catch {
      return false;
    }
  };

  const toggleAwake = async () => {
    if (awake) {
      await lock.current?.release().catch(() => undefined);
      lock.current = null;
      setAwake(false);
      return;
    }
    setAwake(await requestWake());
  };

  // The browser drops the wake lock when the tab is hidden; take it again when visible.
  useEffect(() => {
    if (!awake) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void requestWake();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [awake]);

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold">🔔 Alerts sa phone na ito</p>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${enabled ? "bg-brand-light text-brand" : "bg-gray-100 text-gray-600"}`}>
          {enabled ? "Naka-on" : "Naka-off"}
        </span>
      </div>

      {!enabled ? (
        <>
          <p className="text-sm text-gray-600">Tutunog, magva-vibrate at magpapakita ng notification ang phone na ito kapag may bagong ambulance request.</p>
          <Button full onClick={turnOn}><BellRing className="h-5 w-5" /> I-on ang alerts</Button>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="danger" onClick={() => test("emergency")}><Volume2 className="h-5 w-5" /> Test sirena</Button>
            <Button variant="outline" onClick={() => test("schedule")}><Volume2 className="h-5 w-5" /> Test ding</Button>
          </div>
          <Button variant={awake ? "gold" : "outline"} full onClick={toggleAwake}>
            <Sun className="h-5 w-5" /> {awake ? "Gising ang screen (pindutin para i-off)" : "Panatilihing gising ang screen"}
          </Button>
          <Button variant="ghost" full onClick={() => setAlertsEnabled(false)}><BellOff className="h-5 w-5" /> I-off ang alerts</Button>
        </>
      )}

      {perm === "denied" && (
        <p className="rounded-xl bg-gold-light p-3 text-sm text-yellow-900">
          <b>Naka-block ang notifications.</b> Gagana pa rin ang tunog. Para sa notification: Chrome <b>⋮</b> → <b>Settings</b> → <b>Site settings</b> → <b>Notifications</b> → payagan ang <b>barangay-malineng.web.app</b>.
        </p>
      )}
      {perm === "unsupported" && <p className="text-sm text-gray-500">Hindi suportado ng browser na ito ang notifications. Gagana pa rin ang tunog. Gumamit ng Chrome.</p>}

      <p className="text-xs text-gray-500">
        Gumagana habang <b>bukas ang website</b> sa Chrome, kahit naka-minimize. Hindi ito gagana kapag sinara (na-swipe) ang Chrome o naka-off ang phone.
      </p>
    </Card>
  );
}
