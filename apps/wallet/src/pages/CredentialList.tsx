/**
 * What I hold.
 *
 * Every card states the assurance level in words, because a graduate should be
 * able to see what their own credential will look like to an employer before
 * they send it. A retroactive attestation is not a lesser credential, but it
 * is a different one, and hiding that from the holder would be dishonest in
 * the same way hiding it from the verifier would be.
 */

import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  EmptyState,
  PageHeader,
  Skeleton,
  StatusPill,
  useApi,
  useI18n,
  type Tone,
} from '@civiledger/ui';
import { useSession } from '../session.js';

interface WalletCredential {
  id: string;
  vct: string;
  displayName: string;
  state: string;
  assuranceLevel: string;
  issuedAt: string;
  expiresAt: string | null;
  issuer: { legalName: string; nameBn: string | null; accreditation: string };
}

const STATE_TONE: Record<string, Tone> = {
  ISSUED: 'ok',
  REVOKED: 'danger',
  SUSPENDED: 'warn',
  SUPERSEDED: 'neutral',
};

export function CredentialList() {
  const { t, formatDate, locale } = useI18n();
  const { api } = useSession();
  const navigate = useNavigate();

  const list = useApi(
    useCallback(
      async () => api.get<{ credentials: WalletCredential[] }>('/v1/wallet/credentials'),
      [api],
    ),
  );

  useEffect(() => {
    void list.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PageHeader title={t('wallet.title')} />

      {list.loading && !list.data ? (
        <div className="cl-stack" style={{ gap: 'var(--space-4)' }} aria-busy="true">
          <span className="sr-only">{t('common.loading')}</span>
          <Skeleton height={112} />
          <Skeleton height={112} />
        </div>
      ) : !list.data?.credentials.length ? (
        <EmptyState title={t('wallet.empty')} body={t('wallet.empty.body')} />
      ) : (
        <div className="cl-stack" style={{ gap: 'var(--space-4)' }}>
          {list.data.credentials.map((credential) => {
            const issuerName =
              locale === 'bn' && credential.issuer.nameBn
                ? credential.issuer.nameBn
                : credential.issuer.legalName;

            return (
              <article key={credential.id} className="wallet-credential">
                <div
                  className="cl-row"
                  style={{ justifyContent: 'space-between', gap: 'var(--space-3)' }}
                >
                  <div>
                    <h2 style={{ fontSize: 'var(--text-md)' }}>{credential.displayName}</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                      {issuerName}
                    </p>
                  </div>
                  <StatusPill
                    tone={STATE_TONE[credential.state] ?? 'neutral'}
                    label={t(`state.${credential.state}`)}
                  />
                </div>

                <p
                  style={{
                    marginTop: 'var(--space-3)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {t('assurance.label')}: {t(`assurance.${credential.assuranceLevel}`)}
                </p>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  {t('common.issued')} {formatDate(credential.issuedAt)}
                  {credential.expiresAt
                    ? ` · ${t('common.expires')} ${formatDate(credential.expiresAt)}`
                    : ''}
                </p>

                {credential.state === 'ISSUED' ? (
                  <div style={{ marginTop: 'var(--space-4)' }}>
                    <Button variant="primary" onClick={() => navigate(`/share/${credential.id}`)}>
                      {t('action.share')}
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
