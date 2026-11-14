"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { notificationPermission, playAlertSound, registerServiceWorker, requestNotificationPermission, unlockAudio, type PermissionState } from "@/lib/alerts";
import { NOTIFY_EVENT, notifyPref, setNotifyPref, type NotifyKind } from "@/lib/notifyPrefs";
import { useToast } from "@/components/Toast";

const ROWS: { kind: NotifyKind; label: string; hint: string }[] = [
  { kind: "pabatid", label: "Pabatid at announcement", hint: "Mga abiso ng barangay" },
  { kind: "chat", label: "Chat", hint: "Bagong mensahe sa mga room mo" },
  { kind: "board", label: "Community Board", hint: "Bagong post ng mga kapitbahay" },
  { kind: "donation", label: "Donasyon ko", hint: "Kapag natanggap na ng Barangay ang pangako mo" },
];

/** Account card: allow phone notifications and choose which ones ring (this device only). */
export function NotifySettings() {
  const toast = useToast();
  const [perm, setPerm] = useState<PermissionState>("default");
  const [on, setOn] = useState<Record<NotifyKind, boolean>>({ pabatid: true, chat: true, board: true, donation: true });

  useEffect(() => {
    const read = () => {
      setPerm(notificationPermission());
      setOn({ pabatid: notifyPref("pabatid"), chat: notifyPref("chat"), board: notifyPref("board"), donation: notifyPref("donation") });
    };
    read();
    window.addEventListener(NOTIFY_EVENT, read);
    return () => window.removeEventListener(NOTIFY_EVENT, read);
  }, []);

  async function enable() {
    await unlockAudio(); // browsers only allow sound after a tap
    await registerServiceWorker();
    const p = await requestNotificationPermission();
    setPerm(p);
    if (p === "granted") {
      playAlertSound("schedule");
      toast("Naka-on na ang notification.", "success");
    } else {
      toast("Hindi pinayagan. Pwedeng i-on sa settings ng browser (Site settings → Notifications).", "error");
    }
  }

  if (perm === "unsupported") {
    return <p className="rounded-2xl bg-gray-100 p-3 text-sm text-gray-600">Hindi sinusuportahan ng browser na ito ang notification. Subukan ang Chrome, o i-install ang app sa home screen.</p>;
  }

  return (
    <div className="space-y-3">
      {perm !== "granted" ? (
        <button onClick={enable} className="flex w-full items-center gap-3 rounded-2xl bg-brand-light p-3 text-left text-sm text-brand-deep">
          <BellRing className="h-5 w-5 shrink-0 text-brand" />
          <span>
            <b>I-on ang notification</b> para tumunog ang phone kapag may bago sa chat, board at announcement.
          </span>
        </button>
      ) : (
        <ul className="divide-y divide-gray-100">
          {ROWS.map((r) => (
            <li key={r.kind} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-sm font-bold">{r.label}</span>
                <span className="block text-xs text-gray-500">{r.hint}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on[r.kind]}
                aria-label={r.label}
                onClick={() => setNotifyPref(r.kind, !on[r.kind])}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on[r.kind] ? "bg-brand" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on[r.kind] ? "left-[1.4rem]" : "left-0.5"}`} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-gray-500">Tumutunog lang ito habang <b>bukas ang app</b> (kahit nasa background). Para sa phone na ito lang.</p>
    </div>
  );
}
