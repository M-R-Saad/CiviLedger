/**
 * The dashboard a registrar shows their vice-chancellor. PLAN.html §5.1, §20.3.
 *
 * Deliberately not a hero-metric template. Four plain figures with the
 * question each one answers, and the reuse factor given the interpretation
 * that actually matters: below one this is a service, above five it is
 * infrastructure.
 *
 * The staff-hours figure is labelled an estimate on its face, because it is
 * one. Quoting a modelled number as measured fact is how a pilot loses an
 * institution's trust.
 */

import { useCallback, useEffect } from 'react';
import { PageHeader, Panel, Skeleton, useApi, useI18n } from '@civiledger/ui';
import { useSession } from '../session.js';

interface AnalyticsResponse {
  organization: { name: string; slug: string };
  credentials: { issued: number; revoked: number; total: number };
  verifications: { allTime: number; last30Days: number; reuseFactor: number };
  staffHoursAvoided: { estimate: number; basis: string };
  revenueShare: { bps: number; note: string };
}

export function Analytics() {
  const { t, formatNumber } = useI18n();
  const { api } = useSession();

  const stats = useApi(
    useCallback(async () => api.get<AnalyticsResponse>('/v1/issuer/analytics'), [api]),
  );

  useEffect(() => {
    void stats.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data = stats.data;

  return (
    <>
      <PageHeader title={t('analytics.title')} description={data?.organization.name} />

      <div
        style={{
          display: 'grid',
          gap: 'var(--space-4)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          marginBottom: 'var(--space-6)',
        }}
      >
        <Figure
          label={t('analytics.issued')}
          value={data ? formatNumber(data.credentials.issued) : undefined}
        />
        <Figure
          label={t('analytics.verifications')}
          value={data ? formatNumber(data.verifications.allTime) : undefined}
          note={
            data
              ? `${formatNumber(data.verifications.last30Days)} · ${t('analytics.last30')}`
              : undefined
          }
        />
        <Figure
          label={t('analytics.revoked')}
          value={data ? formatNumber(data.credentials.revoked) : undefined}
        />
        <Figure
          label={t('analytics.hours')}
          value={data ? formatNumber(data.staffHoursAvoided.estimate) : undefined}
          note={data ? t('analytics.estimate') : undefined}
        />
      </div>

      <Panel title={t('analytics.reuse')} description={t('analytics.reuse.hint')}>
        {data ? (
          <>
            <p
              style={{
                fontSize: 'var(--text-2xl)',
                lineHeight: 'var(--leading-2xl)',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatNumber(data.verifications.reuseFactor)}
            </p>
            <ReuseScale value={data.verifications.reuseFactor} />
            <p
              style={{
                marginTop: 'var(--space-4)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-muted)',
                maxWidth: 'var(--prose-max)',
              }}
            >
              {data.staffHoursAvoided.basis}
            </p>
          </>
        ) : (
          <Skeleton height={56} />
        )}
      </Panel>
    </>
  );
}

function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value?: string | undefined;
  note?: string | undefined;
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-container)',
        padding: 'var(--space-4) var(--space-6)',
      }}
    >
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{label}</p>
      <p
        style={{
          marginTop: 'var(--space-2)',
          fontSize: 'var(--text-xl)',
          lineHeight: 'var(--leading-xl)',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value ?? <Skeleton width="4ch" height={24} />}
      </p>
      {note ? (
        <p
          style={{
            marginTop: 'var(--space-1)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-subtle)',
          }}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A bar with the two thresholds marked, rather than a number in isolation.
 * The figure only means something relative to 1 and 5.
 */
function ReuseScale({ value }: { value: number }) {
  const clamped = Math.min(Math.max(value, 0), 8);
  const pct = (clamped / 8) * 100;
  const tone = value >= 5 ? 'var(--ok-fg)' : value >= 1 ? 'var(--warn-fg)' : 'var(--text-subtle)';

  return (
    <div style={{ marginTop: 'var(--space-3)' }} aria-hidden="true">
      <div
        style={{
          position: 'relative',
          height: 8,
          borderRadius: 4,
          background: 'var(--surface-sunken)',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: tone }} />
      </div>
      <div
        style={{
          position: 'relative',
          height: 18,
          fontSize: 'var(--text-xs)',
          color: 'var(--text-subtle)',
        }}
      >
        <span style={{ position: 'absolute', left: '12.5%', transform: 'translateX(-50%)' }}>
          1
        </span>
        <span style={{ position: 'absolute', left: '62.5%', transform: 'translateX(-50%)' }}>
          5
        </span>
      </div>
    </div>
  );
}
