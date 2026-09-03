import { Link } from "react-router-dom";
import { useT } from "../i18n/I18nProvider";
import { Icon } from "../components/ui/Icon";
import { Reveal } from "../components/ui/Reveal";
import { LanguageToggle } from "../components/ui/LanguageToggle";
import { landingImages } from "../lib/landingImages";

const primaryLink =
  "inline-flex h-11 items-center justify-center gap-2 rounded-control bg-accent px-5 text-md font-medium text-paper transition-colors duration-150 ease-out hover:bg-accent-hover";
const secondaryLink =
  "inline-flex h-11 items-center gap-2 rounded-control border border-line-strong bg-surface px-5 text-md font-medium text-ink transition-colors duration-150 ease-out hover:bg-surface-sunken";

function Section({
  id,
  tone = "plain",
  children,
}: {
  id: string;
  tone?: "plain" | "sunken";
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={tone === "sunken" ? "border-t border-line bg-surface-sunken" : "bg-bg"}
    >
      <div className="mx-auto max-w-5xl px-6 py-14 sm:py-20">{children}</div>
    </section>
  );
}

function Figure({
  image,
  alt,
  priority,
  sizes,
  aspect = "aspect-[4/3]",
  position = "object-center",
}: {
  image: (typeof landingImages)[keyof typeof landingImages];
  alt: string;
  priority?: boolean;
  sizes: string;
  aspect?: string;
  position?: string;
}) {
  return (
    <div className="relative">
      <div
        className="absolute -inset-3 rounded-media bg-warm-bg sm:-inset-4"
        aria-hidden="true"
      />
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes={sizes}
        width={image.width}
        height={image.height}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={`relative w-full rounded-media object-cover shadow-media ${aspect} ${position}`}
      />
    </div>
  );
}

export default function LandingPage() {
  const { t } = useT();

  const points = [
    { key: "tamperproof", icon: "shield-check" },
    { key: "citizen", icon: "user-check" },
    { key: "instant", icon: "zap" },
  ];

  const steps = [
    { key: "issue", icon: "file-check-2" },
    { key: "hold", icon: "wallet" },
    { key: "share", icon: "share-2" },
    { key: "verify", icon: "scan-line" },
  ];

  const roles = [
    { key: "institution", icon: "building-2", to: "/login" },
    { key: "citizen", icon: "wallet", to: "/connect-wallet" },
    { key: "verifier", icon: "search-check", to: "/login" },
  ];

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <span className="text-md font-semibold text-ink">{t("app.name")}</span>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link
              to="/login"
              className="rounded-control border border-line-strong px-3 py-1.5 text-sm text-ink transition-colors hover:bg-surface-sunken"
            >
              {t("nav.logIn")}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-warm-bg">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <h1 className="text-balance text-hero font-semibold text-ink">
              {t("landing.hero.title")}
            </h1>
            <p className="mt-5 max-w-[54ch] text-pretty text-md leading-7 text-ink-muted">
              {t("landing.hero.body")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login" className={primaryLink}>
                {t("landing.hero.ctaPrimary")}
                <Icon name="arrow-right" size={18} />
              </Link>
              <a href="#how-it-works" className={secondaryLink}>
                {t("landing.hero.ctaSecondary")}
                <Icon name="arrow-down" size={18} />
              </a>
            </div>
          </div>
          <Figure
            image={landingImages.hero}
            alt={t("landing.hero.imageAlt")}
            priority
            aspect="aspect-[4/3]"
            position="object-[50%_25%]"
            sizes="(min-width: 1024px) 42vw, 100vw"
          />
        </div>
      </section>

      {/* What it does */}
      <Section id="what" tone="sunken">
        <Reveal>
          <h2 className="max-w-2xl text-balance text-xl font-semibold text-ink">
            {t("landing.what.heading")}
          </h2>
          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-3">
            {points.map((p) => (
              <div key={p.key}>
                <Icon name={p.icon} size={24} className="text-accent" />
                <h3 className="mt-3 text-base font-semibold text-ink">
                  {t(`landing.what.${p.key}.title`)}
                </h3>
                <p className="mt-2 text-pretty text-sm leading-6 text-ink-muted">
                  {t(`landing.what.${p.key}.body`)}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </Section>

      {/* How it works */}
      <Section id="how-it-works">
        <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1fr] lg:gap-16">
          <Figure
            image={landingImages.graduate}
            alt={t("landing.how.imageAlt")}
            aspect="aspect-[4/5]"
            sizes="(min-width: 1024px) 36vw, 100vw"
          />
          <Reveal>
            <h2 className="text-xl font-semibold text-ink">
              {t("landing.how.heading")}
            </h2>
            <ol className="mt-8 space-y-6">
              {steps.map((s, i) => (
                <li key={s.key} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-accent-quiet text-accent">
                    <Icon name={s.icon} size={18} />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-ink">
                      <span className="tabular-nums text-ink-subtle">
                        {String(i + 1).padStart(2, "0")}
                      </span>{" "}
                      {t(`landing.how.${s.key}.title`)}
                    </h3>
                    <p className="mt-1 text-pretty text-sm leading-6 text-ink-muted">
                      {t(`landing.how.${s.key}.body`)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </Section>

      {/* Role entry */}
      <Section id="get-started" tone="sunken">
        <Reveal>
          <h2 className="text-xl font-semibold text-ink">
            {t("landing.roles.heading")}
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {roles.map((r) => (
              <Link
                key={r.key}
                to={r.to}
                className="group flex flex-col rounded-container border border-line bg-surface p-5 transition-colors duration-150 ease-out hover:border-line-strong"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-control bg-accent-quiet text-accent">
                  <Icon name={r.icon} size={20} />
                </span>
                <h3 className="mt-3 text-base font-semibold text-ink">
                  {t(`landing.roles.${r.key}.title`)}
                </h3>
                <p className="mt-1 flex-1 text-sm leading-6 text-ink-muted">
                  {t(`landing.roles.${r.key}.body`)}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent">
                  {t(`landing.roles.${r.key}.cta`)}
                  <Icon
                    name="arrow-right"
                    size={16}
                    className="transition-transform duration-150 ease-out motion-safe:group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            ))}
          </div>
        </Reveal>
      </Section>

      {/* Architecture */}
      <Section id="architecture">
        <Reveal>
          <h2 className="text-xl font-semibold text-ink">
            {t("landing.arch.heading")}
          </h2>
          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-16">
            <div>
              <ArchBox icon="layout-grid" labelKey="landing.arch.client.label" detailKey="landing.arch.client.detail" />
              <ArchArrow />
              <div className="grid gap-2 sm:grid-cols-2">
                <ArchBox icon="server" labelKey="landing.arch.app.label" detailKey="landing.arch.app.detail" />
                <ArchBox icon="database" labelKey="landing.arch.db.label" detailKey="landing.arch.db.detail" sunken />
              </div>
              <ArchArrow />
              <ArchBox icon="link" labelKey="landing.arch.chain.label" detailKey="landing.arch.chain.detail" />
            </div>
            <div className="max-w-[60ch] text-pretty text-sm leading-6 text-ink-muted">
              <p>{t("landing.arch.body")}</p>
              <p className="mt-4 flex gap-2.5 rounded-container border border-warm-border bg-warm-bg p-4 text-ink">
                <Icon
                  name="shield-check"
                  size={18}
                  className="mt-0.5 shrink-0 text-ok-fg"
                />
                <span>{t("landing.arch.split")}</span>
              </p>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* Closing */}
      <section className="bg-hero-bg text-hero-fg">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <h2 className="text-balance text-2xl font-semibold text-hero-fg">
              {t("landing.cta.title")}
            </h2>
            <p className="mt-4 max-w-[52ch] text-pretty text-md leading-7 text-hero-fg-muted">
              {t("landing.cta.body")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/login"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-control bg-hero-fg px-5 text-md font-medium text-hero-bg transition-opacity duration-150 hover:opacity-90"
              >
                {t("landing.cta.primary")}
                <Icon name="arrow-right" size={18} />
              </Link>
              <Link
                to="/connect-wallet"
                className="inline-flex h-11 items-center gap-2 rounded-control border border-hero-fg-muted px-5 text-md font-medium text-hero-fg transition-colors hover:border-hero-fg"
              >
                {t("landing.cta.secondary")}
              </Link>
            </div>
          </div>
          <img
            src={landingImages.street.src}
            srcSet={landingImages.street.srcSet}
            sizes="(min-width: 1024px) 42vw, 100vw"
            width={landingImages.street.width}
            height={landingImages.street.height}
            alt={t("landing.cta.imageAlt")}
            loading="lazy"
            decoding="async"
            className="aspect-[3/2] w-full rounded-media object-cover shadow-media"
          />
        </div>
      </section>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-md font-semibold text-ink">{t("app.name")}</p>
        </div>
      </footer>
    </div>
  );
}

function ArchBox({
  icon,
  labelKey,
  detailKey,
  sunken,
}: {
  icon: string;
  labelKey: string;
  detailKey: string;
  sunken?: boolean;
}) {
  const { t } = useT();
  return (
    <div
      className={`flex items-start gap-3 rounded-container border border-line px-4 py-3 ${
        sunken ? "bg-surface-sunken" : "bg-surface"
      }`}
    >
      <Icon name={icon} size={20} className="mt-0.5 shrink-0 text-ink-muted" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{t(labelKey)}</p>
        <p className="text-xs text-ink-muted">{t(detailKey)}</p>
      </div>
    </div>
  );
}

function ArchArrow() {
  return (
    <div className="flex justify-center py-1.5" aria-hidden="true">
      <Icon name="arrow-down" size={16} className="text-ink-subtle" />
    </div>
  );
}
