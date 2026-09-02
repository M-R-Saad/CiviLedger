import { Link } from "react-router-dom";
import { useT } from "../i18n/I18nProvider";
import { LanguageToggle } from "../components/ui/LanguageToggle";
import "../styles/landing.css";

/* ---------- icon sub-components (inline SVG, same weight as icons.tsx) ---------- */

function IconShield(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconFingerprint(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4" />
      <path d="M5 19.5C5.5 18 6 15 6 12c0-3.5 2.5-6 6-6 3 0 5 2 5.5 4" />
      <path d="M8.5 22c.4-2 .5-5 .5-7.5 0-3 1.5-5 3.5-5 1.5 0 3 1.2 3 3" />
      <path d="M14 13c.5 3-.5 7-2 9" />
      <path d="M22 16.5c-1 .5-2 2-3.5 4" />
    </svg>
  );
}

function IconZap(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconArrowRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function IconChevronDown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/* ---------- data ---------- */

const FEATURES = [
  {
    icon: IconShield,
    title: "Tamper-Proof",
    description: "Every credential is anchored on-chain with a cryptographic hash. Any alteration is instantly detectable.",
    gradient: "landing-feature-gradient--shield",
  },
  {
    icon: IconFingerprint,
    title: "Citizen-Controlled",
    description: "Citizens own their credentials in a digital wallet. They choose what to share and with whom — no middleman.",
    gradient: "landing-feature-gradient--fingerprint",
  },
  {
    icon: IconZap,
    title: "Instant Verification",
    description: "Verifiers confirm authenticity in seconds with a QR scan — no phone calls, no waiting for paper copies.",
    gradient: "landing-feature-gradient--zap",
  },
] as const;

const STEPS = [
  { num: "01", label: "Issue", desc: "A government authority issues a digital credential and anchors its hash on the blockchain." },
  { num: "02", label: "Hold", desc: "The citizen receives the credential in their CiviLedger wallet, accessible anytime, anywhere." },
  { num: "03", label: "Share", desc: "The citizen generates a time-limited, purpose-specific presentation link or QR code." },
  { num: "04", label: "Verify", desc: "The verifier scans the code and instantly confirms authenticity against the on-chain record." },
] as const;

const ROLES = [
  {
    emoji: "🏛️",
    title: "I'm an Institution",
    subtitle: "Issue and manage credentials for citizens",
    to: "/login",
    cta: "Log in as Issuer",
    color: "landing-role--institution",
  },
  {
    emoji: "👤",
    title: "I'm a Citizen",
    subtitle: "View, hold, and share your credentials",
    to: "/connect-wallet",
    cta: "Connect Wallet",
    color: "landing-role--citizen",
  },
  {
    emoji: "🔍",
    title: "I'm a Verifier",
    subtitle: "Instantly verify any credential's authenticity",
    to: "/login",
    cta: "Log in as Verifier",
    color: "landing-role--verifier",
  },
] as const;

const TECH_STACK = [
  { label: "Solidity Smart Contracts", detail: "CredentialRegistry, IssuerRegistry, Governance" },
  { label: "Ethereum / Hardhat", detail: "On-chain anchoring & status management" },
  { label: "Node.js + PostgreSQL", detail: "Off-chain credential storage & API" },
  { label: "React + TypeScript", detail: "Role-based dashboards & citizen wallet" },
] as const;

/* ---------- component ---------- */

export default function LandingPage() {
  const { t } = useT();

  return (
    <div className="landing-page">
      {/* -------- NAV -------- */}
      <nav className="landing-nav">
        <div className="landing-nav__inner">
          <span className="landing-nav__brand">{t("app.name")}</span>
          <div className="landing-nav__actions">
            <LanguageToggle />
            <Link to="/login" className="landing-nav__link">
              {t("nav.logIn")}
            </Link>
          </div>
        </div>
      </nav>

      {/* -------- HERO -------- */}
      <section className="landing-hero" id="landing-hero">
        <div className="landing-hero__bg" aria-hidden="true">
          <div className="landing-hero__orb landing-hero__orb--1" />
          <div className="landing-hero__orb landing-hero__orb--2" />
          <div className="landing-hero__orb landing-hero__orb--3" />
        </div>
        <div className="landing-hero__content">
          <span className="landing-hero__badge">
            🔗 Powered by Blockchain
          </span>
          <h1 className="landing-hero__title">
            Decentralized Credential
            <br />
            <span className="landing-hero__title-accent">Verification for Citizens</span>
          </h1>
          <p className="landing-hero__subtitle">
            CiviLedger brings tamper-proof, citizen-controlled, and instantly verifiable government credentials to Bangladesh — replacing paper documents with blockchain-anchored digital trust.
          </p>
          <div className="landing-hero__cta-row">
            <Link to="/login" className="landing-btn landing-btn--primary">
              Get Started
              <IconArrowRight className="landing-btn__icon" />
            </Link>
            <a href="#how-it-works" className="landing-btn landing-btn--ghost">
              How it works
              <IconChevronDown className="landing-btn__icon" />
            </a>
          </div>
        </div>
      </section>

      {/* -------- FEATURES -------- */}
      <section className="landing-section" id="features">
        <div className="landing-section__inner">
          <p className="landing-section__eyebrow">Why CiviLedger?</p>
          <h2 className="landing-section__heading">
            A new standard for document trust
          </h2>
          <div className="landing-features">
            {FEATURES.map((f) => (
              <div key={f.title} className={`landing-feature ${f.gradient}`}>
                <div className="landing-feature__icon-wrap">
                  <f.icon className="landing-feature__icon" />
                </div>
                <h3 className="landing-feature__title">{f.title}</h3>
                <p className="landing-feature__desc">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------- HOW IT WORKS -------- */}
      <section className="landing-section landing-section--alt" id="how-it-works">
        <div className="landing-section__inner">
          <p className="landing-section__eyebrow">The Flow</p>
          <h2 className="landing-section__heading">
            How CiviLedger works
          </h2>
          <div className="landing-steps">
            {STEPS.map((s, i) => (
              <div key={s.num} className="landing-step">
                <div className="landing-step__num">{s.num}</div>
                <h3 className="landing-step__label">{s.label}</h3>
                <p className="landing-step__desc">{s.desc}</p>
                {i < STEPS.length - 1 && (
                  <div className="landing-step__connector" aria-hidden="true">
                    <IconArrowRight className="landing-step__connector-icon" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------- ROLE ENTRY -------- */}
      <section className="landing-section" id="get-started">
        <div className="landing-section__inner">
          <p className="landing-section__eyebrow">Get Started</p>
          <h2 className="landing-section__heading">
            Choose your role
          </h2>
          <div className="landing-roles">
            {ROLES.map((r) => (
              <Link key={r.title} to={r.to} className={`landing-role ${r.color}`}>
                <span className="landing-role__emoji">{r.emoji}</span>
                <h3 className="landing-role__title">{r.title}</h3>
                <p className="landing-role__subtitle">{r.subtitle}</p>
                <span className="landing-role__cta">
                  {r.cta}
                  <IconArrowRight className="landing-role__cta-icon" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* -------- ARCHITECTURE -------- */}
      <section className="landing-section landing-section--alt" id="architecture">
        <div className="landing-section__inner">
          <p className="landing-section__eyebrow">Under the Hood</p>
          <h2 className="landing-section__heading">
            Architecture at a glance
          </h2>
          <div className="landing-arch">
            <div className="landing-arch__diagram">
              {/* Simplified architecture visual */}
              <div className="landing-arch__layer landing-arch__layer--top">
                <div className="landing-arch__node landing-arch__node--primary">
                  <span className="landing-arch__node-emoji">🌐</span>
                  <span className="landing-arch__node-label">React Frontend</span>
                  <span className="landing-arch__node-detail">Role-based dashboards</span>
                </div>
              </div>
              <div className="landing-arch__connector-v" aria-hidden="true" />
              <div className="landing-arch__layer landing-arch__layer--mid">
                <div className="landing-arch__node">
                  <span className="landing-arch__node-emoji">⚙️</span>
                  <span className="landing-arch__node-label">Node.js API</span>
                  <span className="landing-arch__node-detail">REST + JWT Auth</span>
                </div>
                <div className="landing-arch__node">
                  <span className="landing-arch__node-emoji">🗄️</span>
                  <span className="landing-arch__node-label">PostgreSQL</span>
                  <span className="landing-arch__node-detail">Off-chain storage</span>
                </div>
              </div>
              <div className="landing-arch__connector-v" aria-hidden="true" />
              <div className="landing-arch__layer landing-arch__layer--bottom">
                <div className="landing-arch__node landing-arch__node--chain">
                  <span className="landing-arch__node-emoji">⛓️</span>
                  <span className="landing-arch__node-label">Ethereum</span>
                  <span className="landing-arch__node-detail">Smart Contracts</span>
                </div>
              </div>
            </div>
            <div className="landing-arch__list">
              {TECH_STACK.map((t) => (
                <div key={t.label} className="landing-arch__item">
                  <span className="landing-arch__item-dot" />
                  <div>
                    <p className="landing-arch__item-label">{t.label}</p>
                    <p className="landing-arch__item-detail">{t.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* -------- FOOTER -------- */}
      <footer className="landing-footer">
        <div className="landing-footer__inner">
          <span className="landing-footer__brand">{t("app.name")}</span>
          <p className="landing-footer__copy">
            Decentralized Credential Verification for Bangladesh
          </p>
          <p className="landing-footer__copy landing-footer__copy--dim">
            A blockchain-based public sector prototype · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
