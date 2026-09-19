import { useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input, LanguageToggle, Panel, useI18n } from '@civiledger/ui';
import { useSession } from '../session.js';

/**
 * One of the two screens allowed to be a centred stack (DESIGN.md §4).
 * Everything else in the console is left-aligned work.
 */
export function SignIn() {
  const { t } = useI18n();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await signIn(email, password);
    } catch {
      // Deliberately the same message whether the account exists or not.
      setError(t('console.signIn.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cl-shell">
      <header className="cl-topbar">
        <span className="cl-brand">{t('brand.name')}</span>
        <span style={{ flex: 1 }} />
        <LanguageToggle />
      </header>

      <main
        id="main"
        style={{
          flex: 1,
          display: 'grid',
          placeItems: 'center',
          padding: 'var(--space-6)',
        }}
      >
        <div style={{ width: 'min(420px, 100%)' }}>
          <h1 style={{ fontSize: 'var(--text-xl)', lineHeight: 'var(--leading-xl)' }}>
            {t('console.signIn.title')}
          </h1>
          <p style={{ margin: 'var(--space-2) 0 var(--space-6)', color: 'var(--text-muted)' }}>
            {t('console.signIn.body')}
          </p>

          <Panel>
            <form onSubmit={submit} className="cl-stack" style={{ gap: 'var(--space-4)' }}>
              {error ? <Alert variant="error">{error}</Alert> : null}

              <Field label={t('console.email')}>
                {(props) => (
                  <Input
                    {...props}
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.currentTarget.value)}
                    autoComplete="username"
                    required
                  />
                )}
              </Field>

              <Field label={t('console.password')}>
                {(props) => (
                  <Input
                    {...props}
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.currentTarget.value)}
                    autoComplete="current-password"
                    required
                  />
                )}
              </Field>

              <Button type="submit" variant="primary" loading={busy}>
                {t('action.signIn')}
              </Button>
            </form>
          </Panel>
        </div>
      </main>
    </div>
  );
}
