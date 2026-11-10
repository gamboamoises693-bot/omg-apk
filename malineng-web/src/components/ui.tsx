"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronLeft, Loader2, X } from "lucide-react";

/* ---------------- Button ---------------- */
type Variant = "primary" | "gold" | "outline" | "danger" | "ghost" | "soft";

const variantClass: Record<Variant, string> = {
  primary: "bg-brand text-white active:bg-brand-dark",
  gold: "bg-gold text-brand-deep active:bg-gold-dark",
  outline: "border border-gray-200 bg-white text-brand active:bg-brand-light",
  danger: "bg-red-600 text-white active:bg-red-700",
  ghost: "text-brand active:bg-brand-light",
  soft: "bg-brand-light text-brand active:bg-brand-light/70",
};

const buttonBase =
  "inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-xl px-4 py-2 text-[0.95rem] font-semibold transition disabled:opacity-60";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  full?: boolean;
}

export function Button({ variant = "primary", loading, full, className = "", children, disabled, ...rest }: ButtonProps) {
  return (
    <button {...rest} disabled={disabled || loading} className={`${buttonBase} ${variantClass[variant]} ${full ? "w-full" : ""} ${className}`}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "primary", full, className = "", children }: { href: string; variant?: Variant; full?: boolean; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={`${buttonBase} ${variantClass[variant]} ${full ? "w-full" : ""} ${className}`}>
      {children}
    </Link>
  );
}

/* ---------------- Form fields ---------------- */
function FieldWrap({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.85rem] font-semibold text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

// Input text stays >= 16px (see globals.css) so iPhones don't zoom while typing.
const fieldClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2.5 outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15 disabled:bg-gray-100";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }>(
  function Input({ label, hint, className = "", ...rest }, ref) {
    return (
      <FieldWrap label={label} hint={hint}>
        <input ref={ref} {...rest} className={`${fieldClass} ${className}`} />
      </FieldWrap>
    );
  },
);

export function Textarea({ label, hint, className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return (
    <FieldWrap label={label} hint={hint}>
      <textarea {...rest} className={`${fieldClass} min-h-[6rem] ${className}`} />
    </FieldWrap>
  );
}

export function Select({
  label,
  hint,
  options,
  placeholder,
  className = "",
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; options: readonly string[]; placeholder?: string }) {
  return (
    <FieldWrap label={label} hint={hint}>
      <select {...rest} className={`${fieldClass} ${className}`}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </FieldWrap>
  );
}

/** The word for "something else" in every dropdown list. */
export const OTHER_LABEL = "Iba pa";

/**
 * A dropdown whose "Iba pa" choice shows a box where the person writes what it is.
 * `value` is always the FINAL text: a listed option, or what was written ("Iba pa" while nothing is written yet),
 * so forms keep their own checks and saved data holds the real answer.
 */
export function SelectOther({
  label,
  hint,
  options,
  placeholder,
  value,
  onChange,
  required,
  maxLength = 60,
  suggestions = [],
}: {
  label: string;
  hint?: string;
  options: readonly string[];
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  maxLength?: number;
  /** Things other people already wrote, offered as you type (avoids near-duplicates). */
  suggestions?: string[];
}) {
  const hasOther = options.includes(OTHER_LABEL);
  const isOther = hasOther && (value === OTHER_LABEL || (value !== "" && !options.includes(value)));
  const listId = `other-${label.replace(/\W+/g, "-").toLowerCase()}`;

  // Tidy what was written when leaving the box: collapse spaces and start with a capital letter.
  const tidy = (text: string) => {
    const t = text.trim().replace(/\s+/g, " ").slice(0, maxLength);
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : OTHER_LABEL;
  };

  return (
    <div className="space-y-2">
      <FieldWrap label={label} hint={isOther ? undefined : hint}>
        <select
          required={required}
          value={isOther ? OTHER_LABEL : value}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </FieldWrap>
      {isOther && (
        <>
          <input
            aria-label={`${label}: isulat kung ano`}
            placeholder="Isulat kung ano ang iba pa..."
            maxLength={maxLength}
            list={suggestions.length ? listId : undefined}
            value={value === OTHER_LABEL ? "" : value}
            onChange={(e) => onChange(e.target.value.trim() ? e.target.value : OTHER_LABEL)}
            onBlur={(e) => onChange(tidy(e.target.value))}
            className={`${fieldClass} border-brand/40 bg-white`}
            autoFocus={value === OTHER_LABEL}
          />
          {suggestions.length > 0 && (
            <datalist id={listId}>
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
          {hint && <span className="block text-xs text-gray-500">{hint}</span>}
        </>
      )}
    </div>
  );
}

/* ---------------- Layout bits ---------------- */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-card ${className}`}>{children}</div>;
}

// Bottom-nav roots don't need a back button.
const ROOT_PATHS = ["/", "/tindahan", "/board", "/account", "/emergency"];

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  const router = useRouter();
  const pathname = (usePathname() ?? "/").replace(/\/$/, "") || "/";
  const showBack = !ROOT_PATHS.includes(pathname);

  return (
    <div className="mb-4 flex items-center gap-3">
      {showBack && (
        <button
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-card active:bg-gray-100"
          aria-label="Bumalik"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-extrabold text-gray-900">{title}</h1>
        {subtitle && <p className="text-[0.85rem] text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-baseline justify-between gap-2">
      <h2 className="text-base font-bold text-gray-900">{children}</h2>
      {action}
    </div>
  );
}

export function Badge({ children, color = "green" }: { children: ReactNode; color?: "green" | "gold" | "gray" | "red" | "blue" }) {
  const colors = {
    green: "bg-brand-light text-brand",
    gold: "bg-gold-light text-yellow-800",
    gray: "bg-gray-100 text-gray-600",
    red: "bg-red-50 text-red-700",
    blue: "bg-blue-50 text-blue-700",
  } as const;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[color]}`}>{children}</span>;
}

export function Spinner({ label = "Naglo-load..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-white px-6 py-8 text-center text-sm text-gray-500 shadow-card">
      {icon && <div className="mb-2 text-gray-300 [&>svg]:h-10 [&>svg]:w-10">{icon}</div>}
      <p className="font-semibold text-gray-700">{title}</p>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700" role="alert">{children}</p>;
}

/* ---------------- Modal (bottom sheet on phone) ---------------- */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200 sm:hidden" aria-hidden />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded-full bg-gray-100 p-1.5 active:bg-gray-200" aria-label="Isara">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Filter tabs (underline style) ---------------- */
export interface FilterOption<T extends string> {
  value: T;
  label: string;
  /** Optional count badge. */
  count?: number;
  /** "alert" = red badge when > 0 (things to act on); "neutral" = gray. Default "alert". */
  tone?: "alert" | "neutral";
}

/**
 * Underline tabs used for every filter row. Up to 4 options share the width equally;
 * more options scroll sideways (no scrollbar) and the selected one is kept in view.
 */
export function FilterTabs<T extends string>({ options, value, onChange, label }: { options: FilterOption<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const fits = options.length <= 4;

  useEffect(() => {
    if (fits) return;
    const el = rowRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [value, fits]);

  return (
    <div
      ref={rowRef}
      role="tablist"
      aria-label={label}
      className={`mb-3 rounded-2xl bg-white px-1 shadow-card ${fits ? "grid" : "no-scrollbar flex overflow-x-auto"}`}
      style={fits ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o) => {
        const on = o.value === value;
        const badge =
          o.count === undefined ? null : (
            <span
              className={`flex h-[1.1rem] min-w-[1.1rem] shrink-0 items-center justify-center rounded-full px-1 text-[0.65rem] font-black ${
                o.count > 0 && (o.tone ?? "alert") === "alert" ? "bg-red-600 text-white" : "bg-gray-200 text-gray-600"
              }`}
            >
              {o.count > 99 ? "99+" : o.count}
            </span>
          );
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={`flex min-w-0 items-center justify-center gap-1 border-b-[2.5px] py-2.5 text-[0.82rem] transition-colors ${fits ? "px-1" : "shrink-0 px-3"} ${
              on ? "border-brand font-bold text-brand" : "border-transparent font-medium text-gray-500"
            }`}
          >
            <span className="truncate">{o.label}</span>
            {badge}
          </button>
        );
      })}
    </div>
  );
}
