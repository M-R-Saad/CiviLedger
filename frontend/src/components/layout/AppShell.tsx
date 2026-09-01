import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthProvider";
import { useT } from "../../i18n/I18nProvider";
import { Button } from "../ui/Button";
import { LanguageToggle } from "../ui/LanguageToggle";
import { IconMenu } from "../ui/icons";
import { RoleNav } from "./RoleNav";
import { ROLE_HOME } from "./RequireAuth";

export function AppShell() {
  const { user, logout } = useAuth();
  const { t } = useT();
  const [navOpen, setNavOpen] = useState(false);

  const home = user ? ROLE_HOME[user.role] : "/";

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface px-4">
        <button
          type="button"
          onClick={() => setNavOpen((open) => !open)}
          aria-label={t("shell.menu")}
          aria-expanded={navOpen}
          className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-control text-ink-muted hover:bg-surface-sunken lg:hidden"
        >
          <IconMenu className="h-5 w-5" />
        </button>

        <Link to={home} className="text-md font-semibold text-ink">
          {t("app.name")}
        </Link>

        <div className="ml-auto flex items-center gap-3">
          {user && (
            <span className="hidden text-sm text-ink-muted sm:inline">
              {user.full_name ? `${user.full_name} · ` : ""}
              {t(`role.${user.role}`)}
            </span>
          )}
          <LanguageToggle />
          <Button variant="secondary" size="sm" onClick={logout}>
            {t("nav.logOut")}
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1240px] flex-col lg:flex-row">
        <aside
          className={`${
            navOpen ? "block" : "hidden"
          } shrink-0 border-b border-line bg-surface lg:block lg:w-60 lg:border-b-0 lg:border-r`}
        >
          {user && (
            <RoleNav role={user.role} onNavigate={() => setNavOpen(false)} />
          )}
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
