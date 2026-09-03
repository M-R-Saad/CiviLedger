import type { ReactNode } from "react";

/** Short heading, one sentence, one action. Used by every empty list and table. */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      {icon && (
        <div className="text-ink-subtle" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="text-base font-medium text-ink">{title}</p>
      {description && (
        <p className="max-w-[46ch] text-pretty text-sm text-ink-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
