/**
 * The verification result. DESIGN.md §7, PRODUCT.md principles 1 and 4.
 *
 * Not a coloured box with a tick. The verdict is a plain sentence, then the
 * interface shows its working: what was checked, what each check found, how
 * rigorously the institution verified the record in the first place, and which
 * details the holder chose to withhold.
 *
 * Two rules this component exists to enforce:
 *
 *   - A cached result and a live result never look the same (invariant §25).
 *   - Assurance level is always on screen. Presenting a registrar's 2027
 *     confirmation of a 1998 paper certificate as though it were born-digital
 *     would make us the fraud (PLAN §5.2).
 */

import type { Check, VerificationReport } from '@civiledger/verifier';
import { CopyableValue, Panel, StatusPill, type Tone } from './primitives.js';
import { useI18n } from './i18n.js';

const VERDICT_TONE: Record<VerificationReport['result'], Tone> = {
  valid: 'ok',
  revoked: 'danger',
  suspended: 'warn',
  expired: 'warn',
  invalid: 'danger',
  unknown_issuer: 'warn',
  undetermined: 'warn',
};

const OUTCOME_MARK: Record<Check['outcome'], string> = {
  pass: '✓',
  fail: '✕',
  warn: '!',
  skipped: '–',
};

const OUTCOME_COLOR: Record<Check['outcome'], string> = {
  pass: 'var(--ok-fg)',
  fail: 'var(--danger-fg)',
  warn: 'var(--warn-fg)',
  skipped: 'var(--text-subtle)',
};

export function VerificationResult({
  report,
  explorerBaseUrl,
}: {
  report: VerificationReport;
  explorerBaseUrl?: string | undefined;
}) {
  const { t, formatDate } = useI18n();
  const tone = VERDICT_TONE[report.result];

  return (
    <div className="cl-stack" style={{ gap: 'var(--space-6)' }}>
      <Verdict report={report} tone={tone} />

      <Panel title={t('assurance.label')} description={t('assurance.explain')}>
        <dl className="cl-dl">
          <dt>{t('assurance.label')}</dt>
          <dd>
            <strong>{t(`assurance.${report.credential.assuranceLevel}`)}</strong>
          </dd>

          <dt>{t('common.issuer')}</dt>
          <dd>
            {report.issuer.name || '—'}
            {report.issuer.accreditation ? (
              <>
                {' '}
                <StatusPill
                  tone={report.issuer.accreditation === 'UGC_RECOGNIZED' ? 'ok' : 'neutral'}
                  label={t(`accreditation.${report.issuer.accreditation}`)}
                />
              </>
            ) : null}
          </dd>

          {report.credential.evidence.method ? (
            <>
              <dt>{t('check.signature')}</dt>
              <dd>
                {t(`evidence.method.${report.credential.evidence.method}`)}
                {report.credential.evidence.sourceSystem ? (
                  <span style={{ color: 'var(--text-muted)' }}>
                    {' '}
                    ({report.credential.evidence.sourceSystem})
                  </span>
                ) : null}
              </dd>
            </>
          ) : null}

          <dt>{t('common.issued')}</dt>
          <dd>{formatDate(report.credential.issuedAt)}</dd>

          <dt>{t('common.expires')}</dt>
          <dd>
            {report.credential.expiresAt
              ? formatDate(report.credential.expiresAt)
              : t('common.noExpiry')}
          </dd>
        </dl>
      </Panel>

      {Object.keys(report.claims).length > 0 ? (
        <Panel title={t('claims.disclosed')}>
          <dl className="cl-dl">
            {Object.entries(report.claims).map(([name, value]) => (
              <div key={name} style={{ display: 'contents' }}>
                <dt>{t(`claim.${name}`)}</dt>
                <dd>{formatClaim(value)}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      ) : null}

      {report.withheldClaims.length > 0 ? (
        <Panel title={t('claims.withheld')} description={t('claims.withheld.explain')}>
          <div className="cl-row" style={{ gap: 'var(--space-2)' }}>
            {report.withheldClaims.map((name) => (
              <StatusPill key={name} tone="neutral" label={t(`claim.${name}`)} />
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel title={t('check.signature')} flush>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {report.checks.map((check) => (
            <CheckRow key={check.id} check={check} explorerBaseUrl={explorerBaseUrl} />
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function Verdict({ report, tone }: { report: VerificationReport; tone: Tone }) {
  const { t, formatDate } = useI18n();

  const background =
    tone === 'ok' ? 'var(--ok-bg)' : tone === 'danger' ? 'var(--danger-bg)' : 'var(--warn-bg)';
  const border =
    tone === 'ok'
      ? 'var(--ok-border)'
      : tone === 'danger'
        ? 'var(--danger-border)'
        : 'var(--warn-border)';
  const color =
    tone === 'ok' ? 'var(--ok-fg)' : tone === 'danger' ? 'var(--danger-fg)' : 'var(--warn-fg)';

  return (
    <section
      style={{
        background,
        border: `1px solid ${border}`,
        borderRadius: 'var(--radius-container)',
        padding: 'var(--space-6)',
      }}
      aria-live="polite"
    >
      <p
        style={{
          margin: 0,
          fontSize: 'var(--text-xl)',
          lineHeight: 'var(--leading-xl)',
          fontWeight: 600,
          color,
        }}
      >
        {t(`result.${report.result}`)}
      </p>
      <p
        style={{
          margin: 'var(--space-2) 0 0',
          maxWidth: 'var(--prose-max)',
          color: 'var(--text)',
        }}
      >
        {t(`result.${report.result}.body`)}
      </p>

      {/*
        Live and cached must never read the same. A cached answer carries the
        snapshot date on its face, not in a tooltip.
      */}
      <p
        style={{
          margin: 'var(--space-4) 0 0',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-muted)',
          display: 'flex',
          gap: 'var(--space-2)',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <StatusPill
          tone={report.basis === 'live' ? 'ok' : 'neutral'}
          label={report.basis === 'live' ? t('basis.live') : t('basis.cached')}
        />
        {report.basis === 'cached' && report.registrySnapshotAt
          ? t('basis.cached.at', { at: formatDate(report.registrySnapshotAt, true) })
          : null}
        <span>
          {t('common.checkedAt')} {formatDate(report.checkedAt, true)}
        </span>
      </p>
    </section>
  );
}

function CheckRow({
  check,
  explorerBaseUrl,
}: {
  check: Check;
  explorerBaseUrl?: string | undefined;
}) {
  const { t } = useI18n();

  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: '24px 1fr',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-6)',
        borderBottom: '1px solid var(--border)',
        alignItems: 'start',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          color: OUTCOME_COLOR[check.outcome],
          fontWeight: 600,
          lineHeight: 'var(--leading-base)',
        }}
      >
        {OUTCOME_MARK[check.outcome]}
      </span>
      <div>
        <div style={{ fontWeight: 500 }}>
          {t(`check.${check.id}`)}
          <span className="sr-only"> — {check.outcome}</span>
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          {t(`code.${check.code}`, check.vars)}
        </div>
        {check.evidence?.length ? (
          <div className="cl-row" style={{ gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
            {check.evidence.map((item) => (
              <span key={item.labelKey + item.value} style={{ fontSize: 'var(--text-xs)' }}>
                <span style={{ color: 'var(--text-subtle)' }}>{t(item.labelKey)} </span>
                {item.kind === 'hash' || item.kind === 'address' ? (
                  <CopyableValue
                    value={item.value}
                    label={t(item.labelKey)}
                    {...(explorerBaseUrl && item.kind === 'address'
                      ? { href: `${explorerBaseUrl.replace(/\/$/, '')}/address/${item.value}` }
                      : {})}
                  />
                ) : (
                  <span className="mono">{item.value}</span>
                )}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function formatClaim(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? '✓' : '✕';
  if (typeof value === 'number') return String(value);
  return String(value);
}
