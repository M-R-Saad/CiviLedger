import { useT } from "../../i18n/I18nProvider";

export function LanguageToggle() {
  const { lang, setLang, t } = useT();

  const btn = (active: boolean) =>
    `px-3 py-1.5 text-sm ${
      active
        ? "bg-accent-quiet font-medium text-accent"
        : "bg-surface text-ink-muted hover:bg-surface-sunken"
    }`;

  return (
    <div
      className="inline-flex overflow-hidden rounded-control border border-line-strong"
      role="group"
      aria-label={t("lang.toggle")}
    >
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={btn(lang === "en")}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("bn")}
        aria-pressed={lang === "bn"}
        className={`border-l border-line-strong ${btn(lang === "bn")}`}
      >
        বাংলা
      </button>
    </div>
  );
}
