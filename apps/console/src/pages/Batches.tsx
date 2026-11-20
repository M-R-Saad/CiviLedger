/**
 * Batches: what has been signed, and whether it has reached the ledger.
 *
 * The distinction matters and is easy to get wrong in the copy. A batch that
 * is signed but not yet anchored is fully verifiable; anchoring adds external
 * proof of when it existed, not validity. The empty-ish "pending" state must
 * not read as a failure.
 */

import { useCallback, useEffect } from 'react';
import {
  CopyableValue,
  EmptyState,
  PageHeader,
  Panel,
  SkeletonRows,
  StatusPill,
  useApi,
  useI18n,
  type Tone,
} from '@civiledger/ui';
import { useSession } from '../session.js';
import { config } from '../config.js';

interface BatchRecord {
  id: string;
  state: string;
  merkleRoot: string | null;
  leafCount: number;
  onChainBatchId: string | null;
  txHash: string | null;
  anchoredAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

const BATCH_TONE: Record<string, Tone> = {
  PUBLISHED: 'ok',
  ANCHORING: 'warn',
  SIGNING: 'warn',
  APPROVED: 'info',
  PENDING_APPROVAL: 'info',
  DRAFT: 'neutral',
  FAILED: 'danger',
};

export function Batches() {
  const { t, formatDate } = useI18n();
  const { api } = useSession();

  const list = useApi(
    useCallback(async () => api.get<{ batches: BatchRecord[] }>('/v1/issuer/batches'), [api]),
  );

  useEffect(() => {
    void list.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PageHeader title={t('batches.title')} />

      <Panel flush>
        {list.loading && !list.data ? (
          <SkeletonRows rows={4} columns={5} />
        ) : !list.data?.batches.length ? (
          <EmptyState title={t('batches.empty')} body={t('credentials.empty.body')} />
        ) : (
          <div className="cl-table-wrap">
            <table className="cl-table">
              <thead>
                <tr>
                  <th scope="col">{t('credentials.status')}</th>
                  <th scope="col" className="cl-table__num">
                    {t('batches.leafCount')}
                  </th>
                  <th scope="col">{t('batches.anchored')}</th>
                  <th scope="col">{t('evidence.batchId')}</th>
                  <th scope="col">{t('imports.uploaded')}</th>
                </tr>
              </thead>
              <tbody>
                {list.data.batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>
                      <StatusPill
                        tone={BATCH_TONE[batch.state] ?? 'neutral'}
                        label={t(`batch.${batch.state}`)}
                      />
                      {batch.failureReason ? (
                        <div
                          style={{
                            marginTop: 'var(--space-1)',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--danger-fg)',
                          }}
                        >
                          {batch.failureReason}
                        </div>
                      ) : null}
                    </td>
                    <td className="cl-table__num">{batch.leafCount}</td>
                    <td>
                      {batch.anchoredAt ? (
                        <div className="cl-stack" style={{ gap: 'var(--space-1)' }}>
                          <span>{formatDate(batch.anchoredAt, true)}</span>
                          {batch.txHash ? (
                            <CopyableValue
                              value={batch.txHash}
                              label={t('batches.anchored')}
                              {...(config.explorerBaseUrl
                                ? {
                                    href: `${config.explorerBaseUrl.replace(/\/$/, '')}/tx/${batch.txHash}`,
                                  }
                                : {})}
                            />
                          ) : null}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                          {t('batches.pending')}
                        </span>
                      )}
                    </td>
                    <td>
                      {batch.onChainBatchId ? (
                        <CopyableValue value={batch.onChainBatchId} label={t('evidence.batchId')} />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {formatDate(batch.createdAt, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
