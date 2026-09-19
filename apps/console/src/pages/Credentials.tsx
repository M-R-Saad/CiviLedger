/**
 * Credentials, and the one destructive action in the console.
 *
 * Revocation is confirmed inline, names the specific graduate, and states the
 * consequence in plain words before it asks for a reason. A modal with "Are
 * you sure?" would be faster to build and worse: the registrar needs to read
 * the holder's name at the moment they decide.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  EmptyState,
  Field,
  PageHeader,
  Panel,
  Select,
  SkeletonRows,
  StatusPill,
  useApi,
  useI18n,
  useToast,
  type Tone,
} from '@civiledger/ui';
import { useCan, useSession } from '../session.js';

interface CredentialRow {
  id: string;
  vct: string;
  state: string;
  assuranceLevel: string;
  issuedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  subjectName: string;
}

const STATE_TONE: Record<string, Tone> = {
  ISSUED: 'ok',
  REVOKED: 'danger',
  SUSPENDED: 'warn',
  SUPERSEDED: 'neutral',
  DRAFT: 'neutral',
};

const REASONS = [
  'ISSUED_IN_ERROR',
  'RECORD_CORRECTED',
  'FRAUD_CONFIRMED',
  'AWARD_RESCINDED',
  'HOLDER_REQUEST',
  'SUPERSEDED',
  'ADMINISTRATIVE',
] as const;

export function Credentials() {
  const { t, formatDate } = useI18n();
  const { api } = useSession();
  const can = useCan();
  const [revoking, setRevoking] = useState<CredentialRow | undefined>();

  const list = useApi(
    useCallback(
      async () =>
        api.get<{ total: number; credentials: CredentialRow[] }>('/v1/issuer/credentials?take=100'),
      [api],
    ),
  );

  useEffect(() => {
    void list.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PageHeader title={t('credentials.title')} />

      {revoking ? (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <RevokeForm
            credential={revoking}
            onCancel={() => setRevoking(undefined)}
            onDone={() => {
              setRevoking(undefined);
              void list.run();
            }}
          />
        </div>
      ) : null}

      <Panel flush>
        {list.loading && !list.data ? (
          <SkeletonRows rows={6} columns={5} />
        ) : !list.data?.credentials.length ? (
          <EmptyState title={t('credentials.empty')} body={t('credentials.empty.body')} />
        ) : (
          <div className="cl-table-wrap">
            <table className="cl-table">
              <thead>
                <tr>
                  <th scope="col">{t('credentials.holder')}</th>
                  <th scope="col">{t('credentials.type')}</th>
                  <th scope="col">{t('assurance.label')}</th>
                  <th scope="col">{t('credentials.status')}</th>
                  <th scope="col">{t('common.issued')}</th>
                  <th scope="col">
                    <span className="sr-only">{t('action.revoke')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.credentials.map((credential) => (
                  <tr key={credential.id}>
                    <td style={{ fontWeight: 500 }}>{credential.subjectName}</td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {credential.vct.replace('bd.civiledger.', '')}
                    </td>
                    <td>{t(`assurance.${credential.assuranceLevel}`)}</td>
                    <td>
                      <StatusPill
                        tone={STATE_TONE[credential.state] ?? 'neutral'}
                        label={t(`state.${credential.state}`)}
                      />
                      {credential.revokedReason ? (
                        <div
                          style={{
                            marginTop: 'var(--space-1)',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {t(`reason.${credential.revokedReason}`)}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {formatDate(credential.issuedAt)}
                    </td>
                    <td>
                      {can('credential:revoke') && credential.state === 'ISSUED' ? (
                        <Button size="sm" variant="danger" onClick={() => setRevoking(credential)}>
                          {t('action.revoke')}
                        </Button>
                      ) : null}
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

function RevokeForm({
  credential,
  onCancel,
  onDone,
}: {
  credential: CredentialRow;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const { api } = useSession();
  const toast = useToast();
  const [reason, setReason] = useState<string>('ISSUED_IN_ERROR');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const revoke = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await api.post(`/v1/issuer/credentials/${credential.id}/revoke`, { reason });
      toast('success', t('credentials.revoked.toast'));
      onDone();
    } catch (caught) {
      setError((caught as { message?: string }).message ?? 'Revocation failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={t('credentials.revoke.title')}>
      <div className="cl-stack" style={{ gap: 'var(--space-4)' }}>
        {error ? <Alert variant="error">{error}</Alert> : null}

        <Alert variant="warning" title={credential.subjectName}>
          {t('credentials.revoke.body')}
        </Alert>

        <Field label={t('credentials.revoke.reason')}>
          {(props) => (
            <Select
              {...props}
              value={reason}
              onChange={(event) => setReason(event.currentTarget.value)}
            >
              {REASONS.map((value) => (
                <option key={value} value={value}>
                  {t(`reason.${value}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="cl-row" style={{ gap: 'var(--space-2)' }}>
          <Button variant="danger" onClick={revoke} loading={busy}>
            {t('action.revoke')}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {t('action.cancel')}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
