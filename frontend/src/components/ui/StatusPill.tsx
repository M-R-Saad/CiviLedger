import { useT } from "../../i18n/I18nProvider";

const TONE: Record<string, string> = {
  ACTIVE: "border-ok-border bg-ok-bg text-ok-fg",
  VALID: "border-ok-border bg-ok-bg text-ok-fg",
  PENDING: "border-warn-border bg-warn-bg text-warn-fg",
  SUSPENDED: "border-warn-border bg-warn-bg text-warn-fg",
  REVOKED: "border-danger-border bg-danger-bg text-danger-fg",
  EXPIRED: "border-danger-border bg-danger-bg text-danger-fg",
  SUPERSEDED: "border-line bg-surface-sunken text-ink-muted",
};

/** Takes a semantic status key, renders the translated label. Never a raw enum. */
export function StatusPill({ status }: { status: string }) {
  const { t } = useT();
  const tone = TONE[status] ?? "border-line bg-surface-sunken text-ink-muted";
  return (
    <span
      className={`inline-flex items-center rounded-control border px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {t(`status.${status}`)}
    </span>
  );
}
