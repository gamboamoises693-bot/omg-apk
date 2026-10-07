import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "accent" | "danger" | "ghost" | "success";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  accent: "bg-accent text-slate-900 hover:bg-accent-dark",
  danger: "bg-red-600 text-white hover:bg-red-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
  ghost: "bg-white text-brand border border-brand/30 hover:bg-brand-light",
};

export function Button({
  variant = "primary",
  loading,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button className={`btn ${VARIANT[variant]} ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading ? <Spinner small /> : null}
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" {...rest} />
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function Stat({ label, value, tone = "brand", sub }: { label: string; value: ReactNode; tone?: "brand" | "accent" | "red" | "green"; sub?: string }) {
  const tones = {
    brand: "text-brand",
    accent: "text-amber-600",
    red: "text-red-600",
    green: "text-emerald-600",
  };
  return (
    <Card>
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold ${tones[tone]}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-slate-500">{sub}</div> : null}
    </Card>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "yellow" | "red" | "blue" }) {
  const tones = {
    slate: "bg-slate-200 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    yellow: "bg-accent text-slate-900",
    red: "bg-red-100 text-red-700",
    blue: "bg-brand-light text-brand",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

export function LockedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs font-black tracking-wide text-slate-900">
      🔒 LOCKED
    </span>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${small ? "h-4 w-4" : "h-8 w-8"}`}
      aria-label="Loading"
    />
  );
}

export function FullLoader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-brand">
      <Spinner />
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
}

export function Alert({ children, tone = "red" }: { children: ReactNode; tone?: "red" | "yellow" | "green" | "blue" }) {
  const tones = {
    red: "bg-red-50 text-red-800 border-red-200",
    yellow: "bg-amber-50 text-amber-900 border-amber-300",
    green: "bg-emerald-50 text-emerald-800 border-emerald-200",
    blue: "bg-brand-light text-brand border-brand/20",
  };
  return <div className={`rounded-xl border px-3 py-2 text-sm font-medium ${tones[tone]}`}>{children}</div>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand">{title}</h2>
          <button className="text-2xl leading-none text-slate-400" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center text-slate-500">{children}</div>;
}

export function PageTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h1 className="text-xl font-extrabold text-brand">{children}</h1>
      {right}
    </div>
  );
}

/** Copy text with clipboard API fallback for older Android WebViews. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
