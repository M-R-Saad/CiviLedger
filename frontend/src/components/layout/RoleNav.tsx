import type { SVGProps } from "react";
import { NavLink } from "react-router-dom";
import { useT } from "../../i18n/I18nProvider";
import type { Role } from "../../context/AuthProvider";
import {
  IconBuilding,
  IconClock,
  IconFilePlus,
  IconList,
  IconSearch,
  IconWallet,
} from "../ui/icons";

interface NavItem {
  to: string;
  labelKey: string;
  Icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
  end?: boolean;
}

const NAV: Record<Role, NavItem[]> = {
  CITIZEN: [
    { to: "/citizen", labelKey: "nav.myWallet", Icon: IconWallet, end: true },
    { to: "/citizen/audit", labelKey: "nav.sharingHistory", Icon: IconClock },
  ],
  ISSUER_ADMIN: [
    { to: "/issuer", labelKey: "nav.issuedCredentials", Icon: IconList, end: true },
    { to: "/issuer/new", labelKey: "nav.issueNew", Icon: IconFilePlus },
  ],
  VERIFIER_STAFF: [
    { to: "/verifier", labelKey: "nav.verify", Icon: IconSearch, end: true },
  ],
  OVERSIGHT: [
    { to: "/oversight", labelKey: "nav.organizations", Icon: IconBuilding, end: true },
    { to: "/oversight/audit", labelKey: "nav.auditLog", Icon: IconList },
  ],
};

export function RoleNav({
  role,
  onNavigate,
}: {
  role: Role;
  onNavigate?: () => void;
}) {
  const { t } = useT();
  const items = NAV[role] ?? [];

  return (
    <nav className="p-3" aria-label={t("shell.primaryNav")}>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-control px-3 py-2 text-sm ${
                  isActive
                    ? "bg-accent-quiet font-medium text-accent"
                    : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
                }`
              }
            >
              <item.Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t(item.labelKey)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
