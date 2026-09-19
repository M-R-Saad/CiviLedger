/**
 * The review queue.
 *
 * Two lists, not one: rows that are ready, and rows that need attention. A
 * single sortable table would let a registrar approve a batch without ever
 * looking at what was skipped, which is the failure this screen exists to
 * prevent.
 *
 * Approval is the only irreversible action in the console, so it is confirmed
 * inline with the actual count, not behind a modal with a generic warning.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  EmptyState,
  PageHeader,
  Panel,
  SkeletonRows,
  StatusPill,
  useApi,
  useI18n,
  useToast,
} from '@civiledger/ui';
import { useCan, useSession } from '../session.js';

interface ReviewRow {
  id: string;
  rowNumber: number;
  state: string;
  claims: Record<string, unknown>;
  issues: Array<{ claim: string; message: string; severity: 'error' | 'warning' }>;
}

const SUMMARY_CLAIMS = [
  'given_name',
  'family_name',
  'programme',
  'registration_no',
  'graduation_date',
];

export function Review() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const { api } = useSession();
  const can = useCan();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const ready = useApi(
    useCallback(
      async () =>
        api.get<{ total: number; rows: ReviewRow[] }>(
          `/v1/issuer/imports/${id}/review?state=READY&take=200`,
        ),
      [api, id],
    ),
  );
  const conflicts = useApi(
    useCallback(
      async () =>
        api.get<{ total: number; rows: ReviewRow[] }>(
          `/v1/issuer/imports/${id}/review?state=CONFLICT&take=200`,
        ),
      [api, id],
    ),
  );

  useEffect(() => {
    void ready.run();
    void conflicts.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const approve = async () => {
    setApproving(true);
    setError(undefined);
    try {
      const result = await api.post<{ leafCount: number }>(`/v1/issuer/imports/${id}/approve`);
      toast('success', `${result.leafCount} credentials signed`);
      navigate('/batches');
    } catch (caught) {
      const apiError = caught as { code?: string; message?: string };
      setError(
        apiError.code === 'FOUR_EYES_REQUIRED'
          ? t('review.fourEyes')
          : (apiError.message ?? 'Approval failed'),
      );
      setConfirming(false);
    } finally {
      setApproving(false);
    }
  };

  const readyCount = ready.data?.total ?? 0;
  const conflictCount = conflicts.data?.total ?? 0;

  return (
    <>
      <PageHeader
        title={t('review.title')}
        description={t('review.description')}
        actions={
          can('batch:approve') && readyCount > 0 && !confirming ? (
            <Button variant="primary" onClick={() => setConfirming(true)}>
              {t('review.approve')}
            </Button>
          ) : null
        }
      />

      {error ? (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <Alert variant="error">{error}</Alert>
        </div>
      ) : null}

      {confirming ? (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <Alert variant="warning" title={t('review.approve')}>
            <p style={{ marginBottom: 'var(--space-3)' }}>
              {t('review.approve.confirm', { count: readyCount })}
            </p>
            <div className="cl-row" style={{ gap: 'var(--space-2)' }}>
              <Button variant="primary" onClick={approve} loading={approving}>
                {t('review.approve')}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={approving}>
                {t('action.cancel')}
              </Button>
            </div>
          </Alert>
        </div>
      ) : null}

      {conflictCount > 0 ? (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <Panel
            title={`${t('imports.conflicts')} (${conflictCount})`}
            description={t('review.description')}
            flush
          >
            <RowTable rows={conflicts.data?.rows ?? []} loading={conflicts.loading} showIssues />
          </Panel>
        </div>
      ) : null}

      <Panel title={`${t('imports.ready')} (${readyCount})`} flush>
        {ready.loading && !ready.data ? (
          <SkeletonRows rows={6} columns={5} />
        ) : readyCount === 0 ? (
          <EmptyState title={t('imports.empty')} />
        ) : (
          <RowTable rows={ready.data?.rows ?? []} loading={false} />
        )}
      </Panel>
    </>
  );
}

function RowTable({
  rows,
  loading,
  showIssues = false,
}: {
  rows: ReviewRow[];
  loading: boolean;
  showIssues?: boolean;
}) {
  const { t } = useI18n();
  if (loading) return <SkeletonRows rows={4} columns={5} />;

  return (
    <div className="cl-table-wrap">
      <table className="cl-table">
        <thead>
          <tr>
            <th scope="col" className="cl-table__num">
              {t('review.row')}
            </th>
            {SUMMARY_CLAIMS.map((claim) => (
              <th key={claim} scope="col">
                {t(`claim.${claim}`)}
              </th>
            ))}
            {showIssues ? <th scope="col">{t('review.issue')}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="cl-table__num" style={{ color: 'var(--text-muted)' }}>
                {row.rowNumber}
              </td>
              {SUMMARY_CLAIMS.map((claim) => (
                <td key={claim}>{formatValue(row.claims[claim])}</td>
              ))}
              {showIssues ? (
                <td>
                  <div className="cl-stack" style={{ gap: 'var(--space-1)' }}>
                    {row.issues.map((issue) => (
                      <span
                        key={issue.claim + issue.message}
                        style={{ fontSize: 'var(--text-xs)' }}
                      >
                        <StatusPill
                          tone={issue.severity === 'error' ? 'danger' : 'warn'}
                          label={t(`claim.${issue.claim}`)}
                        />{' '}
                        <span style={{ color: 'var(--text-muted)' }}>{issue.message}</span>
                      </span>
                    ))}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}
