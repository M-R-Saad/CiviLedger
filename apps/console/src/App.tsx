/**
 * The Issuer Console. PLAN.html §5.1.
 *
 * The registrar's job: import records, review what normalised cleanly, have a
 * colleague approve, revoke when something is wrong, and show the dashboard to
 * their vice-chancellor. The shell is a left rail because this is the one
 * surface where someone works all shift and needs the whole map visible.
 */

import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Button, LanguageToggle, Panel, Skeleton, useI18n } from '@civiledger/ui';
import { SessionProvider, useCan, useSession } from './session.js';
import { SignIn } from './pages/SignIn.js';
import { Imports } from './pages/Imports.js';
import { Review } from './pages/Review.js';
import { Batches } from './pages/Batches.js';
import { Credentials } from './pages/Credentials.js';
import { Analytics } from './pages/Analytics.js';
import { config } from './config.js';

export function Root() {
  return (
    <SessionProvider baseUrl={config.apiBaseUrl}>
      <App />
    </SessionProvider>
  );
}

function App() {
  const { user, restoring } = useSession();
  const { t } = useI18n();

  if (restoring) {
    return (
      <div className="cl-main cl-main--narrow" aria-busy="true">
        <span className="sr-only">{t('common.loading')}</span>
        <Skeleton height={40} />
      </div>
    );
  }

  if (!user) return <SignIn />;

  return (
    <div className="cl-shell">
      <a className="skip-link" href="#main">
        {t('skip.main')}
      </a>
      <TopBar />
      <div className="cl-body-with-rail">
        <Rail />
        <main id="main" className="cl-main" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<Analytics />} />
            <Route path="/imports" element={<Imports />} />
            <Route path="/imports/:id" element={<Review />} />
            <Route path="/batches" element={<Batches />} />
            <Route path="/credentials" element={<Credentials />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function TopBar() {
  const { user, signOut } = useSession();
  const { t } = useI18n();

  return (
    <header className="cl-topbar">
      <span className="cl-brand">
        <Mark />
        {t('brand.name')}
      </span>
      <span
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-muted)',
          borderInlineStart: '1px solid var(--border)',
          paddingInlineStart: 'var(--space-4)',
        }}
      >
        {user?.organization?.name ?? t('console.title')}
      </span>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
        {user?.displayName}
      </span>
      <LanguageToggle />
      <Button variant="ghost" size="sm" onClick={signOut}>
        {t('action.signOut')}
      </Button>
    </header>
  );
}

function Rail() {
  const { t } = useI18n();
  const can = useCan();

  const links = [
    { to: '/', label: t('console.nav.analytics'), capability: 'analytics:read', end: true },
    { to: '/imports', label: t('console.nav.imports'), capability: 'import:read', end: false },
    { to: '/batches', label: t('console.nav.batches'), capability: 'credential:read', end: false },
    {
      to: '/credentials',
      label: t('console.nav.credentials'),
      capability: 'credential:read',
      end: false,
    },
  ].filter((link) => can(link.capability));

  return (
    <nav className="cl-rail" aria-label={t('console.title')}>
      <div className="cl-rail__group">
        <p className="cl-rail__heading">{t('console.title')}</p>
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end ?? false} className="cl-rail__link">
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <path
        d="M9 16.5l4.5 4.5L23 11.5"
        stroke="var(--text-on-accent)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export { Panel };
