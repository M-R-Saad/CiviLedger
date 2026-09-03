import { Icon as Iconify } from "@iconify/react";

/**
 * The one icon component. Wraps Iconify (https://icon-sets.iconify.design) and
 * pins the project to the Lucide collection. Pass the short name only:
 *
 *   <Icon name="shield-check" />
 *   <Icon name="wallet" size={18} className="text-ink-muted" />
 *   <Icon name="x" label={t("action.dismiss")} />   // meaningful -> gets a11y name
 *
 * Icon data loads from the Iconify API on first use and is cached in
 * localStorage. To go fully offline, swap this for unplugin-icons (static
 * imports, tree-shaken) without touching call sites' intent.
 */

const COLLECTION = "lucide";

export interface IconProps {
  name: string;
  size?: number | string;
  className?: string;
  /** Set when the icon conveys meaning on its own (icon-only button). */
  label?: string;
}

export function Icon({ name, size = 20, className, label }: IconProps) {
  const icon = name.includes(":") ? name : `${COLLECTION}:${name}`;
  return (
    <Iconify
      icon={icon}
      width={size}
      height={size}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
