import { useState } from "react";
import { useT } from "../../i18n/I18nProvider";
import { truncateMiddle } from "../../lib/format";
import { IconCopy, IconExternal } from "./icons";

interface CopyableValueProps {
  value: string;
  /** `token` shows in full; hash / address / tx are truncated in the middle. */
  kind?: "hash" | "address" | "token" | "tx";
  href?: string | null;
}

export function CopyableValue({
  value,
  kind = "token",
  href,
}: CopyableValueProps) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const shown = kind === "token" ? value : truncateMiddle(value);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <code
        className="rounded-[4px] bg-surface-sunken px-1.5 py-0.5 font-mono text-xs text-ink"
        title={value}
      >
        {shown}
      </code>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] text-ink-muted hover:bg-surface-sunken hover:text-ink"
        aria-label={copied ? t("action.copied") : t("action.copy")}
      >
        <IconCopy className="h-3.5 w-3.5" />
      </button>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] text-ink-muted hover:bg-surface-sunken hover:text-ink"
          aria-label={t("action.viewOnExplorer")}
        >
          <IconExternal className="h-3.5 w-3.5" />
        </a>
      )}
      {copied && (
        <span className="text-xs text-ok-fg" role="status">
          {t("action.copied")}
        </span>
      )}
    </span>
  );
}
