"use client";

import Link from "next/link";
import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2, X } from "lucide-react";

/* ---------------- Button ---------------- */
type Variant = "primary" | "gold" | "outline" | "danger" | "ghost";

const variantClass: Record<Variant, string> = {
  primary: "bg-brand text-white active:bg-brand-dark",
  gold: "bg-gold text-brand-dark active:bg-gold-dark",
  outline: "border-2 border-brand text-brand bg-white active:bg-brand-light",
  danger: "bg-red-600 text-white active:bg-red-700",
  ghost: "text-brand active:bg-brand-light",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  full?: boolean;
}

export function Button({ variant = "primary", loading, full, className = "", children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold transition disabled:opacity-60 ${variantClass[variant]} ${full ? "w-full" : ""} ${className}`}
    >
      {loading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "primary", full, className = "", children }: { href: string; variant?: Variant; full?: boolean; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold transition ${variantClass[variant]} ${full ? "w-full" : ""} ${className}`}
    >
      {children}
    </Link>
  );
}

/* ---------------- Form fields ---------------- */
interface FieldWrapProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

function FieldWrap({ label, hint, children }: FieldWrapProps) {
  return (
    <label className="block">
      <span className="mb-1 block font-semibold text-gray-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-gray-500">{hint}</span>}
    </label>
  );
}

const fieldClass =
  "w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-base outline-none focus:border-brand disabled:bg-gray-100";

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
      <textarea {...rest} className={`${fieldClass} min-h-[110px] ${className}`} />
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

/* ---------------- Layout bits ---------------- */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-brand">{title}</h1>
        {subtitle && <p className="text-gray-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 mt-6 text-xl font-bold text-brand">{children}</h2>;
}

export function Badge({ children, color = "green" }: { children: ReactNode; color?: "green" | "gold" | "gray" | "red" | "blue" }) {
  const colors = {
    green: "bg-brand-light text-brand",
    gold: "bg-gold-light text-yellow-800",
    gray: "bg-gray-100 text-gray-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
  } as const;
  return <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${colors[color]}`}>{children}</span>;
}

export function Spinner({ label = "Naglo-load..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-gray-500" role="status">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-white px-6 py-10 text-center text-gray-600 ring-1 ring-gray-100">
      {icon && <div className="mb-3 text-gray-300">{icon}</div>}
      <p className="text-lg font-semibold text-gray-700">{title}</p>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-xl bg-red-50 px-4 py-3 font-medium text-red-700" role="alert">{children}</p>;
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-brand">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 active:bg-gray-100" aria-label="Isara">
            <X className="h-6 w-6" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
