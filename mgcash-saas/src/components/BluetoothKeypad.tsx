import { useEffect, useRef, useState } from "react";
import { PHONE_RE } from "../lib/format";
import { PhoneDisplay } from "./NumberPad";
import { LockedBadge } from "./ui";

/**
 * Listens to a paired Bluetooth numeric keypad (HID keyboard) via global keydown events.
 * There is intentionally NO <input>, so the phone's on-screen keyboard never opens and the
 * tindera cannot type/edit the number. Customer presses ENTER on the keypad to lock.
 */
export function BluetoothKeypad({ onLocked, disabled }: { onLocked: (num: string) => void; disabled?: boolean }) {
  const [digits, setDigits] = useState("");
  const [locked, setLocked] = useState(false);
  const digitsRef = useRef("");
  digitsRef.current = digits;

  useEffect(() => {
    if (locked || disabled) return;
    const onKey = (e: KeyboardEvent) => {
      // Ignore auto-repeat and modifier combos.
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if (/^[0-9]$/.test(k)) {
        e.preventDefault();
        setDigits((d) => (d.length < 11 ? d + k : d));
      } else if (k === "Backspace") {
        e.preventDefault();
        setDigits((d) => d.slice(0, -1));
      } else if (k === "Escape" || k === "Delete" || k === "NumLock") {
        e.preventDefault();
        setDigits("");
      } else if (k === "Enter" || k === "+") {
        e.preventDefault();
        const num = digitsRef.current;
        if (PHONE_RE.test(num)) {
          setLocked(true);
          onLocked(num);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, disabled, onLocked]);

  return (
    <div className="space-y-2">
      <PhoneDisplay value={digits} locked={locked} />
      {locked ? (
        <div className="text-center">
          <LockedBadge />
        </div>
      ) : (
        <p className="text-center text-sm text-slate-600">
          ⌨️ Customer: i-type ang GCash number sa <b>Bluetooth keypad</b> tapos pindutin ang <b>ENTER</b>.
          {digits.length === 11 && !PHONE_RE.test(digits) ? <span className="block text-red-600">Dapat nagsisimula sa 09.</span> : null}
        </p>
      )}
    </div>
  );
}
