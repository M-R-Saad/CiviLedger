/**
 * The claim-scope picker. PLAN.html §3 (selective disclosure), invariant §25.
 *
 * This is the screen the whole privacy story rests on. Two decisions in it:
 *
 *   - Nothing is ticked by default. A pre-ticked list is a consent dark
 *     pattern, and the graduate is meant to be choosing, not confirming.
 *   - Sensitive claims (grades, date of birth, ID fragments) are marked, so
 *     "share my degree" does not quietly also hand over a CGPA.
 *
 * The narrowing is enforced server-side when the link is redeemed. This screen
 * is the graduate's half of that, never the only gate.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Checkbox,
  CopyableValue,
  Field,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  StatusPill,
  useApi,
  useI18n,
} from '@civiledger/ui';
import { useSession } from '../session.js';
import { config } from '../config.js';

interface ClaimDefinition {
  name: string;
  required: boolean;
  label: string;
  sensitive?: boolean;
}

interface WalletCredential {
  id: string;
  vct: string;
  displayName: string;
  state: string;
  issuer: { legalName: string };
  disclosableClaims: ClaimDefinition[];
}

interface CreatedLink {
  token: string;
  url: string;
  expiresAt: string;
  claimScope: string[];
  maxUses: number;
}

const TTL_OPTIONS = [
  { minutes: 15, key: 'wallet.ttl.15m' },
  { minutes: 60, key: 'wallet.ttl.1h' },
  { minutes: 1440, key: 'wallet.ttl.24h' },
  { minutes: 10080, key: 'wallet.ttl.7d' },
];

const PURPOSES = ['JOB_APPLICATION', 'ADMISSION', 'VISA_OR_MIGRATION', 'BANK_OR_KYC', 'OTHER'];

export function Share() {
  const { id = '' } = useParams();
  const { t, formatDate } = useI18n();
  const { api } = useSession();
  const navigate = useNavigate();

  const [scope, setScope] = useState<string[]>([]);
  const [purpose, setPurpose] = useState(PURPOSES[0]!);
  const [ttl, setTtl] = useState(60);
  const [maxUses, setMaxUses] = useState(1);
  const [created, setCreated] = useState<CreatedLink | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const credential = useApi(
    useCallback(async () => api.get<WalletCredential>(`/v1/wallet/credentials/${id}`), [api, id]),
  );

  useEffect(() => {
    void credential.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const create = async () => {
    if (scope.length === 0) {
      setError(t('wallet.share.selectAtLeastOne'));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const link = await api.post<CreatedLink>('/v1/wallet/share-links', {
        credentialId: id,
        claimScope: scope,
        purpose,
        ttlMinutes: ttl,
        maxUses,
      });
      setCreated(link);
    } catch (caught) {
      setError((caught as { message?: string }).message ?? 'Could not create the link');
    } finally {
      setBusy(false);
    }
  };

  if (credential.loading && !credential.data) {
    return <Skeleton height={200} />;
  }

  const data = credential.data;
  if (!data) {
    return <Alert variant="error">{t('error.generic.body')}</Alert>;
  }

  if (created) {
    const shareUrl = created.url.replace(
      /^https?:\/\/[^/]+/,
      config.verifyOrigin.replace(/\/$/, ''),
    );
    return (
      <>
        <PageHeader title={t('wallet.share.created')} />
        <Panel>
          <Alert variant="warning" title={t('wallet.share.created')}>
            {t('wallet.share.copyBody')}
          </Alert>

          <div style={{ marginTop: 'var(--space-4)' }}>
            <CopyableValue value={shareUrl} label={t('wallet.share.title')} />
          </div>

          <dl className="cl-dl" style={{ marginTop: 'var(--space-6)' }}>
            <dt>{t('wallet.share.scope')}</dt>
            <dd>
              <div className="cl-row" style={{ gap: 'var(--space-2)' }}>
                {created.claimScope.map((name) => (
                  <StatusPill key={name} tone="info" label={t(`claim.${name}`)} />
                ))}
              </div>
            </dd>
            <dt>{t('common.expires')}</dt>
            <dd>{formatDate(created.expiresAt, true)}</dd>
            <dt>{t('wallet.share.uses')}</dt>
            <dd>{created.maxUses}</dd>
          </dl>

          <div className="cl-row" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-6)' }}>
            <Button variant="primary" onClick={() => navigate('/links')}>
              {t('wallet.nav.shares')}
            </Button>
            <Button variant="ghost" onClick={() => navigate('/')}>
              {t('action.back')}
            </Button>
          </div>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('wallet.share.title')} description={data.displayName} />

      <div className="cl-stack" style={{ gap: 'var(--space-6)' }}>
        {error ? <Alert variant="error">{error}</Alert> : null}

        <Panel title={t('wallet.share.scope')} description={t('wallet.share.body')}>
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="sr-only">{t('wallet.share.scope')}</legend>
            <div className="wallet-scope">
              {data.disclosableClaims.map((claim) => (
                <div key={claim.name} className="wallet-scope__row">
                  <Checkbox
                    checked={scope.includes(claim.name)}
                    onChange={(checked) => {
                      setError(undefined);
                      setScope((current) =>
                        checked
                          ? [...current, claim.name]
                          : current.filter((name) => name !== claim.name),
                      );
                    }}
                    label={
                      <>
                        {t(`claim.${claim.name}`)}
                        {claim.sensitive ? (
                          <>
                            {' '}
                            <StatusPill tone="warn" label={t('wallet.share.sensitive')} />
                          </>
                        ) : null}
                      </>
                    }
                  />
                </div>
              ))}
            </div>
          </fieldset>
        </Panel>

        <Panel>
          <div
            style={{
              display: 'grid',
              gap: 'var(--space-4)',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            }}
          >
            <Field label={t('wallet.share.purpose')}>
              {(props) => (
                <Select
                  {...props}
                  value={purpose}
                  onChange={(event) => setPurpose(event.currentTarget.value)}
                >
                  {PURPOSES.map((value) => (
                    <option key={value} value={value}>
                      {value.replace(/_/g, ' ').toLowerCase()}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label={t('wallet.share.ttl')}>
              {(props) => (
                <Select
                  {...props}
                  value={String(ttl)}
                  onChange={(event) => setTtl(Number(event.currentTarget.value))}
                >
                  {TTL_OPTIONS.map((option) => (
                    <option key={option.minutes} value={option.minutes}>
                      {t(option.key)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label={t('wallet.share.uses')}>
              {(props) => (
                <Select
                  {...props}
                  value={String(maxUses)}
                  onChange={(event) => setMaxUses(Number(event.currentTarget.value))}
                >
                  {[1, 2, 3, 5, 10].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <div className="cl-row" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-6)' }}>
            <Button variant="primary" onClick={create} loading={busy} disabled={scope.length === 0}>
              {t('wallet.share.create')}
            </Button>
            <Button variant="ghost" onClick={() => navigate('/')} disabled={busy}>
              {t('action.cancel')}
            </Button>
          </div>
        </Panel>
      </div>
    </>
  );
}
