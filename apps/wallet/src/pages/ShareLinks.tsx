/**
 * Links I have shared, and how to withdraw one.
 *
 * The token is never shown again. It exists once, at creation; storing it here
 * would turn this list into a set of live credentials sitting behind a single
 * session. Withdrawal works on the link's identity, not on knowing its secret.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  EmptyState,
  PageHeader,
  Panel,
  Skeleton,
  StatusPill,
  useApi,
  useI18n,
  useToast,
  type Tone,
} from '@civiledger/ui';
import { useSession } from '../session.js';

interface ShareLinkRow {
  id: string;
  claimScope: string[];
  purpose: string;
  expiresAt: string;
  maxUses: number;
  useCount: number;
  revokedAt: string | null;
  createdAt: string;
}

export function ShareLinks() {
  const { t, formatDate } = useI18n();
  const { api } = useSession();
  const toast = useToast();
  const [withdrawing, setWithdrawing] = useState<string | undefined>();

  const list = useApi(
    useCallback(
      async () => api.get<{ shareLinks: ShareLinkRow[] }>('/v1/wallet/share-links'),
      [api],
    ),
  );

  useEffect(() => {
    void list.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const withdraw = async (link: ShareLinkRow) => {
    setWithdrawing(link.id);
    try {
      await api.del(`/v1/wallet/share-links/${link.id}`);
      toast('success', t('wallet.shares.withdrawn'));
      await list.run();
    } catch (caught) {
      toast('error', (caught as { message?: string }).message ?? 'Could not withdraw the link');
    } finally {
      setWithdrawing(undefined);
    }
  };

  const statusOf = (link: ShareLinkRow): { tone: Tone; label: string } => {
    if (link.revokedAt) return { tone: 'neutral', label: t('wallet.shares.withdrawn') };
    if (new Date(link.expiresAt).getTime() <= Date.now()) {
      return { tone: 'neutral', label: t('code.EXPIRED') };
    }
    if (link.useCount >= link.maxUses) {
      return { tone: 'neutral', label: t('code.SHARE_LINK_USED_UP') };
    }
    return { tone: 'ok', label: t('state.ISSUED') };
  };

  return (
    <>
      <PageHeader title={t('wallet.nav.shares')} />

      {list.loading && !list.data ? (
        <div className="cl-stack" style={{ gap: 'var(--space-4)' }} aria-busy="true">
          <span className="sr-only">{t('common.loading')}</span>
          <Skeleton height={96} />
        </div>
      ) : !list.data?.shareLinks.length ? (
        <EmptyState title={t('wallet.shares.empty')} body={t('wallet.shares.empty.body')} />
      ) : (
        <div className="cl-stack" style={{ gap: 'var(--space-4)' }}>
          {list.data.shareLinks.map((link) => {
            const status = statusOf(link);
            const active = status.tone === 'ok';

            return (
              <Panel key={link.id}>
                <div
                  className="cl-row"
                  style={{ justifyContent: 'space-between', gap: 'var(--space-3)' }}
                >
                  <div>
                    <p style={{ fontWeight: 600 }}>
                      {link.purpose.replace(/_/g, ' ').toLowerCase()}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                      {t('common.expires')} {formatDate(link.expiresAt, true)}
                      {' · '}
                      {t('wallet.shares.uses', { used: link.useCount, max: link.maxUses })}
                    </p>
                  </div>
                  <StatusPill tone={status.tone} label={status.label} />
                </div>

                <div
                  className="cl-row"
                  style={{ gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}
                >
                  {link.claimScope.map((name) => (
                    <StatusPill key={name} tone="neutral" label={t(`claim.${name}`)} />
                  ))}
                </div>

                {active ? (
                  <div style={{ marginTop: 'var(--space-4)' }}>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => void withdraw(link)}
                      loading={withdrawing === link.id}
                    >
                      {t('wallet.shares.withdraw')}
                    </Button>
                  </div>
                ) : null}
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
