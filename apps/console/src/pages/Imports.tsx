/**
 * Imports: upload a record export and see the review queue.
 *
 * The form is deliberately not a wizard. A registrar doing this monthly wants
 * every field on one screen, and the assurance and evidence block is the part
 * that matters most, so it sits in the form rather than behind a step.
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Checkbox,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Panel,
  Select,
  SkeletonRows,
  StatusPill,
  Textarea,
  useApi,
  useI18n,
  useToast,
} from '@civiledger/ui';
import { useCan, useSession } from '../session.js';

interface ImportRecord {
  id: string;
  filename: string;
  vct: string;
  state: string;
  rowCount: number;
  readyCount: number;
  conflictCount: number;
  assuranceLevel: string;
  createdAt: string;
}

interface CredentialType {
  vct: string;
  displayName: string;
}

const ASSURANCE_LEVELS = ['AL1', 'AL2', 'AL3', 'AL3_PLUS'] as const;

const EVIDENCE_FOR_ASSURANCE: Record<string, string> = {
  AL1: 'DOCUMENT_SCAN_OCR',
  AL2: 'REGISTRAR_SOURCE_CHECK',
  AL3: 'SYSTEM_OF_RECORD_SYNC',
  AL3_PLUS: 'SYSTEM_OF_RECORD_SYNC_WITH_ID_CHECK',
};

export function Imports() {
  const { t, formatDate } = useI18n();
  const { api } = useSession();
  const can = useCan();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const list = useApi(
    useCallback(async () => api.get<{ imports: ImportRecord[] }>('/v1/issuer/imports'), [api]),
  );

  useEffect(() => {
    void list.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PageHeader
        title={t('imports.title')}
        description={t('imports.description')}
        actions={
          can('import:create') ? (
            <Button variant="primary" onClick={() => setCreating((open) => !open)}>
              {t('imports.new')}
            </Button>
          ) : null
        }
      />

      {creating ? (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <NewImport
            onDone={(id) => {
              setCreating(false);
              void list.run();
              navigate(`/imports/${id}`);
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : null}

      <Panel flush>
        {list.loading && !list.data ? (
          <SkeletonRows rows={4} columns={5} />
        ) : !list.data?.imports.length ? (
          <EmptyState title={t('imports.empty')} body={t('imports.empty.body')} />
        ) : (
          <div className="cl-table-wrap">
            <table className="cl-table">
              <thead>
                <tr>
                  <th scope="col">{t('imports.file')}</th>
                  <th scope="col">{t('assurance.label')}</th>
                  <th scope="col" className="cl-table__num">
                    {t('imports.rows')}
                  </th>
                  <th scope="col" className="cl-table__num">
                    {t('imports.ready')}
                  </th>
                  <th scope="col" className="cl-table__num">
                    {t('imports.conflicts')}
                  </th>
                  <th scope="col">{t('credentials.status')}</th>
                  <th scope="col">{t('imports.uploaded')}</th>
                  <th scope="col">
                    <span className="sr-only">{t('imports.review')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.imports.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{record.filename}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                        {record.vct}
                      </div>
                    </td>
                    <td>{t(`assurance.${record.assuranceLevel}`)}</td>
                    <td className="cl-table__num">{record.rowCount}</td>
                    <td className="cl-table__num">{record.readyCount}</td>
                    <td className="cl-table__num">
                      {record.conflictCount > 0 ? (
                        <strong style={{ color: 'var(--warn-fg)' }}>{record.conflictCount}</strong>
                      ) : (
                        record.conflictCount
                      )}
                    </td>
                    <td>
                      <StatusPill
                        tone={
                          record.state === 'APPROVED'
                            ? 'ok'
                            : record.state === 'REVIEW'
                              ? 'warn'
                              : 'neutral'
                        }
                        label={t(`import.${record.state}`)}
                      />
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {formatDate(record.createdAt, true)}
                    </td>
                    <td>
                      <Button size="sm" onClick={() => navigate(`/imports/${record.id}`)}>
                        {t('imports.review')}
                      </Button>
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

function NewImport({ onDone, onCancel }: { onDone: (id: string) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const { api } = useSession();
  const toast = useToast();

  const [types, setTypes] = useState<CredentialType[]>([]);
  const [vct, setVct] = useState('bd.civiledger.academic.degree.v1');
  const [filename, setFilename] = useState('');
  const [csv, setCsv] = useState('');
  const [assurance, setAssurance] = useState<string>('AL2');
  const [sourceSystem, setSourceSystem] = useState('');
  const [checkedByRole, setCheckedByRole] = useState('');
  const [checkedAt, setCheckedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [synthetic, setSynthetic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    void api
      .get<{ types: CredentialType[] }>('/v1/credential-types')
      .then((result) => setTypes(result.types))
      .catch(() => undefined);
  }, [api]);

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    setFilename(file.name);
    void file.text().then(setCsv);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const result = await api.post<{ id: string; readyCount: number; conflictCount: number }>(
        '/v1/issuer/imports',
        {
          vct,
          filename: filename || 'import.csv',
          csv,
          assuranceLevel: assurance,
          evidence: {
            method: EVIDENCE_FOR_ASSURANCE[assurance] ?? 'REGISTRAR_SOURCE_CHECK',
            source_system: sourceSystem,
            checked_at: checkedAt,
            checked_by_role: checkedByRole,
          },
          syntheticData: synthetic,
        },
      );
      toast('success', `${result.readyCount} ready, ${result.conflictCount} need attention`);
      onDone(result.id);
    } catch (caught) {
      const apiError = caught as { code?: string; message?: string };
      setError(
        apiError.code === 'REAL_DATA_NOT_PERMITTED'
          ? t('imports.synthetic.hint')
          : (apiError.message ?? 'Upload failed'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={t('imports.new')}>
      <form onSubmit={submit} className="cl-stack" style={{ gap: 'var(--space-6)' }}>
        {error ? <Alert variant="error">{error}</Alert> : null}

        <div
          style={{
            display: 'grid',
            gap: 'var(--space-4)',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          }}
        >
          <Field label={t('imports.type')}>
            {(props) => (
              <Select
                {...props}
                value={vct}
                onChange={(event) => setVct(event.currentTarget.value)}
              >
                {(types.length ? types : [{ vct, displayName: vct }]).map((type) => (
                  <option key={type.vct} value={type.vct}>
                    {type.displayName}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label={t('imports.assurance')} hint={t('imports.assurance.hint')}>
            {(props) => (
              <Select
                {...props}
                value={assurance}
                onChange={(event) => setAssurance(event.currentTarget.value)}
              >
                {ASSURANCE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {t(`assurance.${level}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label={t('imports.sourceSystem')}>
            {(props) => (
              <Input
                {...props}
                value={sourceSystem}
                onChange={(event) => setSourceSystem(event.currentTarget.value)}
                placeholder="UIU SIS"
                required
              />
            )}
          </Field>

          <Field label={t('imports.checkedBy')}>
            {(props) => (
              <Input
                {...props}
                value={checkedByRole}
                onChange={(event) => setCheckedByRole(event.currentTarget.value)}
                placeholder="EXAM_CONTROLLER"
                required
              />
            )}
          </Field>

          <Field label={t('imports.checkedAt')}>
            {(props) => (
              <Input
                {...props}
                type="date"
                value={checkedAt}
                onChange={(event) => setCheckedAt(event.currentTarget.value)}
                required
              />
            )}
          </Field>
        </div>

        <Field label={t('imports.file')} hint={t('imports.file.hint')}>
          {(props) => (
            <div className="cl-stack" style={{ gap: 'var(--space-3)' }}>
              <Input
                {...props}
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => pickFile(event.currentTarget.files?.[0])}
              />
              <Textarea
                value={csv}
                onChange={(event) => setCsv(event.currentTarget.value)}
                placeholder="given_name,family_name,…"
                aria-label={t('imports.file')}
                rows={6}
              />
            </div>
          )}
        </Field>

        <Checkbox
          checked={synthetic}
          onChange={setSynthetic}
          label={t('imports.synthetic')}
          hint={t('imports.synthetic.hint')}
        />

        <div className="cl-row" style={{ gap: 'var(--space-2)' }}>
          <Button type="submit" variant="primary" loading={busy} disabled={!csv.trim()}>
            {t('action.upload')}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            {t('action.cancel')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
