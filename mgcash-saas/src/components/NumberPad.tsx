import { PHONE_RE } from "../lib/format";

/** Big on-screen 0-9 pad for the customer's own phone. */
export function NumberPad({ value, onChange, maxLen = 11 }: { value: string; onChange: (v: string) => void; maxLen?: number }) {
  const press = (k: string) => {
    if (k === "⌫") return onChange(value.slice(0, -1));
    if (k === "C") return onChange("");
    if (value.length < maxLen) onChange(value + k);
  };
  return (
    <div className="grid grid-cols-3 gap-2">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          className="min-h-16 rounded-xl bg-white text-2xl font-bold text-brand shadow-sm active:bg-brand-light"
        >
          {k}
        </button>
      ))}
    </div>
  );
}

/** 0917 123 4567 style display. */
export function PhoneDisplay({ value, locked }: { value: string; locked?: boolean }) {
  const shown = value.padEnd(11, "•");
  const pretty = `${shown.slice(0, 4)} ${shown.slice(4, 7)} ${shown.slice(7)}`;
  const valid = PHONE_RE.test(value);
  return (
    <div
      className={`whitespace-nowrap rounded-2xl border-4 px-2 py-4 text-center font-mono text-2xl font-black tracking-wider sm:text-3xl sm:tracking-widest ${
        locked ? "border-accent bg-accent/20 text-slate-900" : valid ? "border-emerald-500 text-brand" : "border-slate-300 text-brand"
      }`}
    >
      {pretty}
    </div>
  );
}
