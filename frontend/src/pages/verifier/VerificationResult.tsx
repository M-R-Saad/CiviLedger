import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { verifierApi } from "../../services/api";
import { useAuth } from "../../context/AuthProvider";
import { useT } from "../../i18n/I18nProvider";
import { formatDateTime } from "../../lib/format";
import { addressUrl } from "../../lib/explorer";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel } from "../../components/ui/Panel";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Skeleton } from "../../components/ui/Skeleton";
import { CopyableValue } from "../../components/ui/CopyableValue";
import { LanguageToggle } from "../../components/ui/LanguageToggle";
import { IconCheck, IconDash, IconX } from "../../components/ui/icons";

type CheckKey = "hash" | "issuer" | "status" | "expiry";

interface Evidence {
  labelKey: string;
  value: string;
  kind: "hash" | "address" | "token" | "tx";
}

interface Check {
  key: CheckKey;
  pass: boolean;
  code: string;
  vars?: Record<string, string>;
  evidence?: Evidence[];
}

interface CredentialResult {
  credentialId: string;
  credentialType: string | null;
  issuerName: string | null;
  verdict: string;
  checks: Check[];
  anchor?: { anchorId: string; issuer: string; issuedAt: string };
}

interface CheckResponse {
  overall: string;
  results: CredentialResult[];
  recorded: boolean;
  receiptTx?: string | null;
  presentation: {
    shareToken: string;
    credentialCount: number;
    createdAt: string;
    expiresAt: string;
  };
}

const INDETERMINATE = new Set(["STATUS_UNKNOWN", "CHAIN_UNREACHABLE"]);

type Tone = "ok" | "warn" | "danger";

function verdictTone(verdict: string): Tone {
  if (verdict === "VALID") return "ok";
  if (verdict === "SUSPENDED" || verdict === "EXPIRED" || INDETERMINATE.has(verdict)) {
    return "warn";
  }
  return "danger";
}

const BANNER_TONE: Record<Tone, string> = {
  ok: "border-ok-border bg-ok-bg text-ok-fg",
  warn: "border-warn-border bg-warn-bg text-warn-fg",
  danger: "border-danger-border bg-danger-bg text-danger-fg",
};

export default function VerificationResult() {
  const { token } = useParams();
  const { t, lang } = useT();
  const { user } = useAuth();

  const [data, setData] = useState<CheckResponse | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [errorKey, setErrorKey] = useState("verify.error.generic");
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState(false);

  const role = user?.role ?? null;

  const runCheck = useCallback(async () => {
    if (!token) return;
    setPhase("loading");
    setRecordError(false);
    try {
      const res = await verifierApi.check(token);
      setData(res.data);
      setPhase("ready");
    } catch (err: unknown) {
      const status =
        typeof err === "object" && err && "response" in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      const hasResponse =
        typeof err === "object" && err !== null && "response" in err &&
        Boolean((err as { response?: unknown }).response);
      setErrorKey(
        status === 404
          ? "verify.error.notFound"
          : status === 410
            ? "verify.error.expired"
            : !hasResponse
              ? "verify.error.network"
              : "verify.error.generic"
      );
      setPhase("error");
    }
  }, [token]);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  async function recordOfficial() {
    if (!token) return;
    setRecording(true);
    setRecordError(false);
    try {
      const res = await verifierApi.verify(token);
      setData((prev) =>
        prev
          ? {
              ...prev,
              overall: res.data.overall,
              results: res.data.results,
              recorded: res.data.recorded,
              receiptTx: res.data.receiptTx,
            }
          : prev
      );
    } catch {
      setRecordError(true);
    } finally {
      setRecording(false);
    }
  }

  const canRecord =
    role === "VERIFIER_STAFF" &&
    data &&
    !data.recorded &&
    !INDETERMINATE.has(data.overall);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title={t("verify.title")}
        description={t("verify.subtitle")}
        actions={<LanguageToggle />}
      />

      {phase === "loading" && (
        <div className="space-y-4" aria-live="polite" aria-busy="true">
          <p className="text-sm text-ink-muted">{t("verify.loading")}</p>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {phase === "error" && (
        <Alert variant="error" title={t("verify.title")}>
          <p>{t(errorKey)}</p>
          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={runCheck}>
              {t("verify.recheck")}
            </Button>
          </div>
        </Alert>
      )}

      {phase === "ready" && data && (
        <div className="space-y-6">
          <VerdictBanner verdict={data.overall} />

          <p className="text-sm text-ink-muted">
            {t("verify.credentialCount", { count: data.presentation.credentialCount })}
            {" · "}
            {t("verify.sharedAt", {
              datetime: formatDateTime(data.presentation.createdAt, lang),
            })}
          </p>

          {data.results.map((result) => (
            <Panel
              key={result.credentialId}
              title={result.credentialType || t("common.credential")}
            >
              <dl className="mb-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-ink-muted">{t("common.issuer")}</dt>
                <dd className="text-ink">{result.issuerName || t("common.na")}</dd>
                {result.anchor && (
                  <>
                    <dt className="text-ink-muted">
                      {t("verify.evidence.anchorId")}
                    </dt>
                    <dd>
                      <CopyableValue value={result.anchor.anchorId} kind="hash" />
                    </dd>
                  </>
                )}
              </dl>

              {result.checks.length > 0 ? (
                <ul className="divide-y divide-line border-y border-line">
                  {result.checks.map((check) => (
                    <CheckLine key={check.key} check={check} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">
                  {t(`verify.verdictHint.${result.verdict}`)}
                </p>
              )}
            </Panel>
          ))}

          {canRecord && (
            <div>
              <Button onClick={recordOfficial} loading={recording}>
                {recording
                  ? t("verify.recording")
                  : t("verify.recordOfficial")}
              </Button>
            </div>
          )}

          {recordError && (
            <Alert variant="error">
              <p>{t("verify.error.generic")}</p>
            </Alert>
          )}

          {data.recorded && (
            <Alert variant="success" title={t("verify.recordedTitle")}>
              <p>{t("verify.recordedBody")}</p>
              {data.receiptTx && (
                <p className="mt-2">
                  <span className="text-ink-muted">{t("verify.receiptTx")}: </span>
                  <CopyableValue value={data.receiptTx} kind="tx" />
                </p>
              )}
            </Alert>
          )}
        </div>
      )}
    </main>
  );
}

function VerdictBanner({ verdict }: { verdict: string }) {
  const { t } = useT();
  const tone = verdictTone(verdict);
  const Icon = tone === "ok" ? IconCheck : tone === "warn" ? IconDash : IconX;

  return (
    <div
      className={`flex items-start gap-3 rounded-container border p-4 ${BANNER_TONE[tone]}`}
      role="status"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="text-md font-semibold">{t(`verify.verdict.${verdict}`)}</p>
        <p className="mt-1 text-sm">{t(`verify.verdictHint.${verdict}`)}</p>
        {verdict === "VALID" && (
          <p className="mt-1 text-xs">{t("verify.checkedNow")}</p>
        )}
      </div>
    </div>
  );
}

function CheckLine({ check }: { check: Check }) {
  const { t } = useT();
  const Icon = check.pass ? IconCheck : IconX;
  const tone = check.pass ? "text-ok-fg" : "text-danger-fg";

  return (
    <li className="flex gap-3 py-3">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{t(`verify.check.${check.key}`)}</p>
        <p className="text-sm text-ink-muted">
          {t(`verify.checkDetail.${check.code}`, check.vars)}
        </p>
        {check.evidence && check.evidence.length > 0 && (
          <dl className="mt-2 space-y-1">
            {check.evidence.map((evidence) => (
              <div
                key={evidence.labelKey}
                className="flex flex-wrap items-center gap-x-2 text-xs"
              >
                <dt className="text-ink-subtle">{t(evidence.labelKey)}</dt>
                <dd>
                  <CopyableValue
                    value={evidence.value}
                    kind={evidence.kind}
                    href={
                      evidence.kind === "address"
                        ? addressUrl(evidence.value)
                        : undefined
                    }
                  />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </li>
  );
}
