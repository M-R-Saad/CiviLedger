import type { ReactNode } from "react";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: "accent" | "ok" | "warn" | "danger" | "default";
  subtitle?: string;
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  accent:  { bg: "bg-accent-quiet",  text: "text-accent",    border: "border-accent-border" },
  ok:      { bg: "bg-ok-bg",         text: "text-ok-fg",     border: "border-ok-border" },
  warn:    { bg: "bg-warn-bg",       text: "text-warn-fg",   border: "border-warn-border" },
  danger:  { bg: "bg-danger-bg",     text: "text-danger-fg", border: "border-danger-border" },
  default: { bg: "bg-surface-sunken", text: "text-ink",      border: "border-line" },
};

export function StatsCard({ label, value, icon, color = "default", subtitle }: StatsCardProps) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.default;

  return (
    <div className={`rounded-container border ${c.border} ${c.bg} p-4 flex flex-col gap-1`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted uppercase tracking-wide">{label}</span>
        {icon && <span className={`${c.text} opacity-60`}>{icon}</span>}
      </div>
      <span className={`text-2xl font-bold ${c.text}`}>{value}</span>
      {subtitle && <span className="text-xs text-ink-subtle">{subtitle}</span>}
    </div>
  );
}
