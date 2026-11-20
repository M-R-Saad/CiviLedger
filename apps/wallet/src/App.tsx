/**
 * The graduate's wallet. PLAN.html §5.1, §10.
 *
 * Three things, in the order a graduate needs them: what I hold, what I have
 * shared, and who has looked. A bottom tab bar rather than a left rail because
 * this is the one surface that is primarily a phone.
 */

import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Button, LanguageToggle, Skeleton, useI18n } from '@civiledger/ui';
import { SessionProvider, useSession } from './session.js';
import { SignIn } from './pages/SignIn.js';
import { CredentialList } from './pages/CredentialList.js';
import { Share } from './pages/Share.js';
import { ShareLinks } from './pages/ShareLinks.js';
import { Receipts } from './pages/Receipts.js';
import { config } from './config.js';

export function Root() {
  return (
    <SessionProvider baseUrl={config.apiBaseUrl}>
      <App />
    </SessionProvider>
  );
}

function App() {
  const { holder, restoring } = useSession();
  const { t } = useI18n();

  if (restoring) {
    return (
      <div className="cl-main cl-main--narrow" aria-busy="true">
        <span className="sr-only">{t('common.loading')}</span>
        <Skeleton height={40} />
      </div>
    );
  }

  if (!holder) return <SignIn />;

  return (
    <div className="cl-shell">
      <a className="skip-link" href="#main">
        {t('skip.main')}
      </a>
      <TopBar />

      <main id="main" className="cl-main cl-main--narrow wallet-main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<CredentialList />} />
          <Route path="/share/:id" element={<Share />} />
          <Route path="/links" element={<ShareLinks />} />
          <Route path="/receipts" element={<Receipts />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <TabBar />
    </div>
  );
}

function TopBar() {
  const { holder, signOut } = useSession();
  const { t } = useI18n();

  return (
    <header className="cl-topbar">
      <span className="cl-brand">
        <Mark />
        {t('brand.name')}
      </span>
      <span style={{ flex: 1 }} />
      <span
        style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}
        className="wallet-name"
      >
        {holder?.displayName}
      </span>
      <LanguageToggle />
      <Button variant="ghost" size="sm" onClick={signOut}>
        {t('action.signOut')}
      </Button>
    </header>
  );
}

/**
 * Three destinations, always visible, labelled in words.
 * Icon-only tab bars fail exactly the user this product is for.
 */
function TabBar() {
  const { t } = useI18n();
  const tabs = [
    { to: '/', label: t('wallet.nav.credentials'), end: true },
    { to: '/links', label: t('wallet.nav.shares'), end: false },
    { to: '/receipts', label: t('wallet.nav.receipts'), end: false },
  ];

  return (
    <nav className="wallet-tabs" aria-label={t('wallet.title')}>
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className="wallet-tab">
          {tab.label}
        </NavLink>
      ))}
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
