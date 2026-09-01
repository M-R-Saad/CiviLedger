import type { ReactNode } from "react";
import { IconCheck, IconDash, IconX } from "./icons";

type Variant = "info" | "success" | "warning" | "error";

const TONE: Record<Variant, string> = {
  info: "border-accent-border bg-accent-quiet text-ink",
  success: "border-ok-border bg-ok-bg text-ok-fg",
  warning: "border-warn-border bg-warn-bg text-warn-fg",
  error: "border-danger-border bg-danger-bg text-danger-fg",
};

const ICON: Record<Variant, (props: { className?: string }) => ReactNode> = {
  info: IconDash,
  success: IconCheck,
  warning: IconDash,
  error: IconX,
};

export function Alert({
  variant = "info",
  title,
  children,
}: {
  variant?: Variant;
  title?: ReactNode;
  children?: ReactNode;
}) {
  const Icon = ICON[variant];
  return (
    <div
      className={`flex gap-3 rounded-container border p-4 ${TONE[variant]}`}
      role={variant === "error" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
