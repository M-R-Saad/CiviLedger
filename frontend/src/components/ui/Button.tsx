import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./icons";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-paper hover:bg-accent-hover active:bg-accent-active",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-surface-sunken",
  ghost: "bg-transparent text-ink hover:bg-surface-sunken",
  danger: "bg-danger-fg text-paper hover:opacity-90",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-control font-medium transition-[background-color,opacity] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4 motion-safe:animate-spin" />}
      {children}
    </button>
  );
}
