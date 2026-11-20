/**
 * The public verification page. PLAN.html §5.1, §5.3.
 *
 * No authentication, no account, no install. Someone scans a QR on a CV and
 * has an answer before they have decided whether to trust the page. Everything
 * here serves that: one route deep, the verdict first, the reasoning under it.
 */

import { useCallback, useEffect, useState } from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Field,
  Input,
  LanguageToggle,
  Panel,
  Skeleton,
  useApi,
  useI18n,
  VerificationResult,
  createApiClient,
  ApiError,
} from '@civiledger/ui';
import type { VerificationReport } from '@civiledger/verifier';
import { config } from './config.js';

const api = createApiClient({ baseUrl: config.apiBaseUrl });

export function App() {
  const { t } = useI18n();

  return (
    <div className="cl-shell">
      <a className="skip-link" href="#main">
        {t('skip.main')}
      </a>
      <header className="cl-topbar">
        <a className="cl-brand" href="/">
          <Mark />
          {t('brand.name')}
        </a>
        <span style={{ flex: 1 }} />
        <LanguageToggle />
      </header>

      <main id="main" className="cl-main cl-main--narrow" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Start />} />
          <Route path="/v/:token" element={<Result />} />
          <Route path="*" element={<Start />} />
        </Routes>
      </main>

      <Footer />
    </div>
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

/**
 * The entry screen.
 *
 * Most arrivals skip this entirely by scanning a QR. It exists for the person
 * who was emailed a link and pasted it into the wrong box, and for the employer
 * who was given a bare token over the phone.
 */
function Start() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const token = extractToken(value);
    if (!token) {
      setError(t('start.badToken'));
      return;
    }
    navigate(`/v/${token}`);
  };

  return (
    <>
      <h1 style={{ fontSize: 'var(--text-xl)', lineHeight: 'var(--leading-xl)' }}>
        {t('start.title')}
      </h1>
      <p
        style={{
          margin: 'var(--space-3) 0 var(--space-8)',
          color: 'var(--text-muted)',
          maxWidth: 'var(--prose-max)',
        }}
      >
        {t('start.body')}
      </p>

      <Panel>
        <form onSubmit={submit} className="cl-stack" style={{ gap: 'var(--space-4)' }}>
          <Field label={t('start.label')} hint={t('start.hint')} {...(error ? { error } : {})}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                value={value}
                onChange={(event) => {
                  setValue(event.currentTarget.value);
                  setError(undefined);
                }}
                placeholder="https://verify.civiledger.com.bd/v/…"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="go"
              />
            )}
          </Field>
          <div>
            <Button type="submit" variant="primary">
              {t('action.verify')}
            </Button>
          </div>
        </form>
      </Panel>

      <div style={{ marginTop: 'var(--space-8)' }}>
        <Alert variant="info" title={t('start.openTitle')}>
          {t('start.openBody')}{' '}
          <a href={config.specUrl} target="_blank" rel="noreferrer noopener">
            {t('start.openLink')}
          </a>
        </Alert>
      </div>
    </>
  );
}

function Result() {
  const { token = '' } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();

  const verify = useCallback(
    async () => api.post<VerificationReport>('/v1/verify', { shareToken: token }),
    [token],
  );
  const { data, error, loading, run } = useApi(verify);

  useEffect(() => {
    void run();
  }, [run]);

  if (loading && !data) return <ResultSkeleton />;

  if (error) {
    return (
      <>
        <Alert variant={error.status === 410 ? 'warning' : 'error'} title={errorTitle(error, t)}>
          {errorBody(error, t)}
        </Alert>
        <div className="cl-row" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-6)' }}>
          <Button variant="secondary" onClick={() => void run()}>
            {t('action.retry')}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')}>
            {t('action.verifyAnother')}
          </Button>
        </div>
      </>
    );
  }

  if (!data) return <ResultSkeleton />;

  return (
    <>
      <VerificationResult
        report={data}
        {...(config.explorerBaseUrl ? { explorerBaseUrl: config.explorerBaseUrl } : {})}
      />
      <div className="cl-row" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-6)' }}>
        <Button variant="secondary" onClick={() => navigate('/')}>
          {t('action.verifyAnother')}
        </Button>
        <Button variant="ghost" onClick={() => void run()} loading={loading}>
          {t('result.recheck')}
        </Button>
      </div>
    </>
  );
}

/**
 * Shape-matched placeholders, not a spinner.
 *
 * The verdict block is the tallest thing on the page; reserving its height
 * stops the answer from shoving the rest of the layout down as it arrives.
 */
function ResultSkeleton() {
  const { t } = useI18n();
  return (
    <div className="cl-stack" style={{ gap: 'var(--space-6)' }} aria-busy="true">
      <span className="sr-only">{t('common.loading')}</span>
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-container)',
          padding: 'var(--space-6)',
        }}
      >
        <Skeleton width="62%" height={28} />
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Skeleton width="86%" height={18} />
        </div>
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Skeleton width="45%" height={20} />
        </div>
      </div>
      <Panel>
        <div className="cl-stack" style={{ gap: 'var(--space-3)' }}>
          <Skeleton width="70%" />
          <Skeleton width="55%" />
          <Skeleton width="62%" />
        </div>
      </Panel>
    </div>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border)',
        padding: 'var(--space-6)',
        fontSize: 'var(--text-sm)',
        color: 'var(--text-muted)',
      }}
    >
      <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto' }}>
        {t('footer.note')}{' '}
        <a
          href={`${config.apiBaseUrl}/v1/registry/snapshot`}
          target="_blank"
          rel="noreferrer noopener"
        >
          {t('footer.registry')}
        </a>
      </div>
    </footer>
  );
}

/** Accept a full share URL, a bare token, or something pasted with whitespace. */
export function extractToken(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const fromUrl = /\/v\/([A-Za-z0-9_-]{16,})/.exec(trimmed);
  if (fromUrl?.[1]) return fromUrl[1];

  return /^[A-Za-z0-9_-]{16,}$/.test(trimmed) ? trimmed : undefined;
}

function errorTitle(error: ApiError, t: (key: string) => string): string {
  if (error.status === 404) return t('error.notFound');
  if (error.status === 410) return t(`code.${error.code}`);
  if (error.status === 0) return t('error.offline');
  return t('error.generic');
}

function errorBody(error: ApiError, t: (key: string) => string): string {
  if (error.status === 404) return t('error.notFound.body');
  if (error.status === 410) return t('error.expired.body');
  if (error.status === 0) return t('error.offline.body');
  return t('error.generic.body');
}
