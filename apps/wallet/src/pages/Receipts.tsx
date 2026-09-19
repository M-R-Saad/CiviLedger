/**
 * Who checked my credentials. PLAN.html §10.
 *
 * The transparency feature, and the reason a phishing verifier is discoverable
 * at all: a graduate who sees "a company I never applied to read my date of
 * birth" has the evidence to report it.
 *
 * Each entry says what was actually disclosed, not merely that a check
 * happened. And it says whether the receipt has reached the daily audit root,
 * because a receipt that is only in our database is a promise, while one in an
 * anchored root is evidence.
 */

import { useCallback, useEffect } from 'react';
import {
  EmptyState,
  PageHeader,
  Panel,
  Skeleton,
  StatusPill,
  useApi,
  useI18n,
  type Tone,
} from '@civiledger/ui';
import { useSession } from '../session.js';

interface Receipt {
  id: string;
  at: string;
  purpose: string;
  claimsDisclosed: string[];
  verifier: string;
  result: string;
  credential: { id: string; vct: string } | null;
  anchored: { periodStart: number; digest: string } | null;
}

const RESULT_TONE: Record<string, Tone> = {
  VALID: 'ok',
  REVOKED: 'danger',
  SUSPENDED: 'warn',
  EXPIRED: 'warn',
  INVALID: 'danger',
  UNKNOWN_ISSUER: 'warn',
  UNDETERMINED: 'neutral',
};

export function Receipts() {
  const { t, formatDate } = useI18n();
  const { api } = useSession();

  const list = useApi(
    useCallback(
      async () => api.get<{ total: number; receipts: Receipt[] }>('/v1/wallet/receipts?take=100'),
      [api],
    ),
  );

  useEffect(() => {
    void list.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PageHeader title={t('wallet.nav.receipts')} />

      {list.loading && !list.data ? (
        <div className="cl-stack" style={{ gap: 'var(--space-4)' }} aria-busy="true">
          <span className="sr-only">{t('common.loading')}</span>
          <Skeleton height={96} />
          <Skeleton height={96} />
        </div>
      ) : !list.data?.receipts.length ? (
        <EmptyState title={t('wallet.receipts.empty')} body={t('wallet.receipts.empty.body')} />
      ) : (
        <div className="cl-stack" style={{ gap: 'var(--space-4)' }}>
          {list.data.receipts.map((receipt) => (
            <Panel key={receipt.id}>
              <div
                className="cl-row"
                style={{ justifyContent: 'space-between', gap: 'var(--space-3)' }}
              >
                <div>
                  <p style={{ fontWeight: 600 }}>{receipt.verifier}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    {formatDate(receipt.at, true)}
                    {' · '}
                    {receipt.purpose.replace(/_/g, ' ').toLowerCase()}
                  </p>
                </div>
                <StatusPill
                  tone={RESULT_TONE[receipt.result] ?? 'neutral'}
                  label={t(`result.${receipt.result.toLowerCase()}`)}
                />
              </div>

              <p
                style={{
                  marginTop: 'var(--space-4)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-muted)',
                }}
              >
                {t('wallet.receipts.saw')}
              </p>
              <div
                className="cl-row"
                style={{ gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}
              >
                {receipt.claimsDisclosed.length === 0 ? (
                  <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>
                    {t('common.none')}
                  </span>
                ) : (
                  receipt.claimsDisclosed.map((name) => (
                    <StatusPill key={name} tone="neutral" label={t(`claim.${name}`)} />
                  ))
                )}
              </div>

              <p
                style={{
                  marginTop: 'var(--space-4)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-subtle)',
                }}
              >
                {receipt.anchored ? t('wallet.receipts.anchored') : t('wallet.receipts.pending')}
              </p>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
