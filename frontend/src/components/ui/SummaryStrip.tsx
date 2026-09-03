export interface SummaryItem {
  label: string;
  value: string | number;
  /** Tint the number only when it carries meaning (e.g. a revoked count). */
  tone?: "default" | "ok" | "warn" | "danger" | "accent";
}

const TONE: Record<NonNullable<SummaryItem["tone"]>, string> = {
  default: "text-ink",
  ok: "text-ok-fg",
  warn: "text-warn-fg",
  danger: "text-danger-fg",
  accent: "text-accent",
};

/**
 * A quiet one-line summary above a table. Deliberately not metric cards:
 * numbers get weight, not colored fills.
 */
export function SummaryStrip({
  items,
  className = "",
}: {
  items: SummaryItem[];
  className?: string;
}) {
  return (
    <dl
      className={`flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm ${className}`}
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-1.5">
          <dt className="text-ink-muted">{item.label}</dt>
          <dd className={`font-semibold tabular-nums ${TONE[item.tone ?? "default"]}`}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
