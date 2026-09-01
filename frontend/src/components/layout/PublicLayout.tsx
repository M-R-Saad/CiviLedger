import { Link, Outlet } from "react-router-dom";
import { useT } from "../../i18n/I18nProvider";
import { LanguageToggle } from "../ui/LanguageToggle";

/** Minimal chrome for auth screens and the public /verify/:token page. */
export function PublicLayout() {
  const { t } = useT();
  return (
    <div className="min-h-screen bg-bg">
      <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-6">
        <Link to="/login" className="text-md font-semibold text-ink">
          {t("app.name")}
        </Link>
        <LanguageToggle />
      </header>
      <Outlet />
    </div>
  );
}
