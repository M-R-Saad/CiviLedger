/**
 * The six-step verification. PLAN.html §5.3.
 *
 *   1. issuer known, and its key valid AT SIGNING TIME   → IssuerDirectory
 *   2. signature over the disclosed claims               → local crypto
 *   3. status bit set?                                   → status list
 *   4. status list hash matches the chain?               → StatusListSource
 *   5. anchor inclusion proof valid?                     → AnchorSource
 *   6. holder binding satisfied?                         → key-binding JWT
 *
 * Steps 1–4 and 6 work entirely against a cached registry snapshot and a cached
 * status list, so a district office with intermittent connectivity can still
 * verify (PLAN §12.3). When that happens the result says so: a cached result is
 * never presented as a live one.
 *
 * The engine fails closed. Any check it could not complete downgrades the
 * result to `undetermined` rather than letting it pass — "we could not reach
 * the chain" must never read as "this degree is real".
 */

import {
  CredentialError,
  parseSdJwt,
  verifyCredential,
  type VerifiedCredential,
} from '@civiledger/credential';
import { checkStatus, StatusListError, type VersionFloor } from '@civiledger/status-list';
import {
  type AnchorProof,
  type AnchorSource,
  type Check,
  type CheckOutcome,
  type CredentialSummary,
  type IssuerDirectory,
  type IssuerResolution,
  type StatusListSource,
  type StatusSummary,
  type VerificationReport,
  type VerificationResult,
} from './types.js';

export interface VerifyPresentationOptions {
  /** Compact SD-JWT presentation, optionally with a key-binding JWT. */
  sdJwt: string;
  /** Inclusion proof, when the presentation carries one. Step 5. */
  anchor?: AnchorProof;
  issuers: IssuerDirectory;
  statusLists: StatusListSource;
  anchors?: AnchorSource;
  /** Seconds since epoch. Injected so results are reproducible. */
  now: number;
  /** Set when the verifier issued a challenge and requires holder binding. */
  expectedAudience?: string;
  expectedNonce?: string;
  requireKeyBinding?: boolean;
  /** Persist this to defend against status-list rollback across checks. */
  versionFloor?: VersionFloor;
  clockSkewSeconds?: number;
}

export async function verifyPresentation(
  options: VerifyPresentationOptions,
): Promise<VerificationReport> {
  const { sdJwt, issuers, statusLists, now, clockSkewSeconds = 60 } = options;
  const checks: Check[] = [];
  const checkedAt = new Date(now * 1000).toISOString();

  // --- read the unverified payload just far enough to find the issuer -------
  let unverified: { iss: string; iat: number };
  try {
    unverified = peekIssuer(sdJwt);
  } catch (error) {
    return malformed(checkedAt, issuers, error);
  }

  // --- step 1: is this issuer in the registry, and was its key valid? -------
  let issuer: IssuerResolution | undefined;
  let directoryReachable = true;
  try {
    issuer = await issuers.resolve(unverified.iss, unverified.iat);
  } catch {
    directoryReachable = false;
  }

  if (!directoryReachable) {
    checks.push({
      id: 'issuer_known',
      outcome: 'warn',
      code: 'REGISTRY_UNREACHABLE',
      vars: { iss: unverified.iss },
    });
    return undetermined(checkedAt, issuers, checks, unverified.iss, 'REGISTRY_UNREACHABLE');
  }
  if (!issuer) {
    checks.push({
      id: 'issuer_known',
      outcome: 'fail',
      code: 'ISSUER_NOT_IN_REGISTRY',
      vars: { iss: unverified.iss },
    });
    return unknownIssuer(checkedAt, issuers, checks, unverified.iss);
  }

  checks.push({
    id: 'issuer_known',
    outcome: issuer.status === 'ACTIVE' ? 'pass' : 'warn',
    code: issuer.status === 'ACTIVE' ? 'ISSUER_ACTIVE' : `ISSUER_${issuer.status}`,
    evidence: [
      { labelKey: 'evidence.orgId', value: issuer.orgId, kind: 'hash' },
      { labelKey: 'evidence.didWeb', value: issuer.didWeb, kind: 'text' },
    ],
  });

  // --- step 2: the signature, and step 1's timestamp-scoped key validity ----
  let verified: VerifiedCredential;
  try {
    verified = await verifyCredential({
      sdJwt,
      now,
      clockSkewSeconds,
      resolveIssuerKey: async () => ({
        jwk: issuer!.jwk,
        thumbprint: issuer!.keyThumbprint,
        validAtSigningTime: issuer!.validAtSigningTime,
        ...(issuer!.revocationReason === undefined
          ? {}
          : { revocationReason: issuer!.revocationReason }),
      }),
      ...(options.expectedAudience === undefined
        ? {}
        : { expectedAudience: options.expectedAudience }),
      ...(options.expectedNonce === undefined ? {} : { expectedNonce: options.expectedNonce }),
      ...(options.requireKeyBinding === undefined
        ? {}
        : { requireKeyBinding: options.requireKeyBinding }),
    });
  } catch (error) {
    return cryptoFailure(checkedAt, issuers, checks, issuer, error);
  }

  checks.push({
    id: 'issuer_key_valid_at_signing',
    outcome: 'pass',
    code: 'KEY_VALID_AT_SIGNING',
    evidence: [
      { labelKey: 'evidence.keyThumbprint', value: issuer.keyThumbprint, kind: 'hash' },
      {
        labelKey: 'evidence.signedAt',
        value: new Date(unverified.iat * 1000).toISOString(),
        kind: 'timestamp',
      },
    ],
  });
  checks.push({ id: 'signature', outcome: 'pass', code: 'SIGNATURE_OK' });

  // --- steps 3 and 4: status bit, and the list's on-chain anchor ------------
  const status = await runStatusChecks({
    verified,
    issuer,
    statusLists,
    now,
    clockSkewSeconds,
    ...(options.versionFloor === undefined ? {} : { versionFloor: options.versionFloor }),
    checks,
  });

  // --- step 5: anchor inclusion --------------------------------------------
  let anchorProof: CheckOutcome = 'skipped';
  if (options.anchor && options.anchors) {
    try {
      const included = await options.anchors.verify(options.anchor);
      anchorProof = included ? 'pass' : 'fail';
      checks.push({
        id: 'anchor_inclusion',
        outcome: anchorProof,
        code: included ? 'ANCHOR_INCLUDED' : 'ANCHOR_NOT_INCLUDED',
        evidence: [{ labelKey: 'evidence.batchId', value: options.anchor.batchId, kind: 'hash' }],
      });
    } catch {
      anchorProof = 'warn';
      checks.push({ id: 'anchor_inclusion', outcome: 'warn', code: 'ANCHOR_UNREACHABLE' });
    }
  } else {
    checks.push({ id: 'anchor_inclusion', outcome: 'skipped', code: 'ANCHOR_NOT_PRESENTED' });
  }

  // --- step 6: holder binding ----------------------------------------------
  checks.push({
    id: 'holder_binding',
    outcome: verified.holderBinding === 'verified' ? 'pass' : 'skipped',
    code:
      verified.holderBinding === 'verified' ? 'HOLDER_BINDING_VERIFIED' : 'HOLDER_BINDING_ABSENT',
  });

  const result = decide({ status, anchorProof, issuerStatus: issuer.status, checks });

  return {
    result: result.result,
    checkedAt,
    basis: issuers.basis,
    ...(issuers.snapshotAt === undefined
      ? {}
      : { registrySnapshotAt: new Date(issuers.snapshotAt * 1000).toISOString() }),
    issuer: {
      iss: unverified.iss,
      orgId: issuer.orgId,
      name: readString(verified.payload, 'issuer_name') ?? issuer.name,
      accreditation: readString(verified.payload, 'accreditation') ?? issuer.accreditation,
      status: issuer.status,
      didWeb: issuer.didWeb,
      keyValidAtSigning: issuer.validAtSigningTime,
      ...(issuer.revocationReason === undefined
        ? {}
        : { keyRevocationReason: issuer.revocationReason }),
    },
    credential: summarise(verified),
    claims: verified.disclosedClaims,
    withheldClaims: verified.withheldClaimNames,
    status,
    integrity: {
      signature: 'pass',
      anchorProof,
      ...(options.anchor ? { anchorBatchId: options.anchor.batchId } : {}),
    },
    holderBinding: verified.holderBinding,
    checks,
    ...(result.failureCode === undefined ? {} : { failureCode: result.failureCode }),
  };
}

// ---------------------------------------------------------------

async function runStatusChecks(args: {
  verified: VerifiedCredential;
  issuer: IssuerResolution;
  statusLists: StatusListSource;
  now: number;
  clockSkewSeconds: number;
  versionFloor?: VersionFloor;
  checks: Check[];
}): Promise<StatusSummary> {
  const { verified, issuer, statusLists, now, clockSkewSeconds, versionFloor, checks } = args;

  const claim = verified.payload['status'] as
    { status_list?: { idx?: unknown; uri?: unknown } } | undefined;
  const idx = claim?.status_list?.idx;
  const uri = claim?.status_list?.uri;

  if (typeof idx !== 'number' || typeof uri !== 'string') {
    // A credential with no status claim can never be revoked. That is a
    // property of the credential, not a check that passed, so say so plainly.
    checks.push({ id: 'status', outcome: 'skipped', code: 'NO_STATUS_LIST' });
    checks.push({ id: 'status_list_anchored', outcome: 'skipped', code: 'NO_STATUS_LIST' });
    return {
      revoked: false,
      suspended: false,
      listHashMatchesChain: false,
      pendingAnchor: false,
      fresh: false,
    };
  }

  const listId = parseListId(uri);

  let jwt: string | undefined;
  try {
    jwt = await statusLists.fetch(uri);
  } catch {
    jwt = undefined;
  }
  if (!jwt) {
    checks.push({ id: 'status', outcome: 'warn', code: 'STATUS_LIST_UNREACHABLE', vars: { uri } });
    checks.push({ id: 'status_list_anchored', outcome: 'warn', code: 'STATUS_LIST_UNREACHABLE' });
    return {
      revoked: false,
      suspended: false,
      listHashMatchesChain: false,
      pendingAnchor: false,
      fresh: false,
    };
  }

  let onChain;
  let chainReachable = true;
  try {
    onChain = listId === undefined ? undefined : await statusLists.onChain(issuer.orgId, listId);
  } catch {
    chainReachable = false;
  }

  try {
    const result = await checkStatus({
      jwt,
      index: idx,
      issuerJwk: issuer.jwk,
      now,
      clockSkewSeconds,
      expectedUri: uri,
      ...(onChain ? { onChain } : {}),
      ...(versionFloor ? { versionFloor } : {}),
    });

    const revoked = result.purpose === 'revocation' && result.set;
    const suspended = result.purpose === 'suspension' && result.set;

    checks.push({
      id: 'status',
      outcome: result.set ? 'fail' : 'pass',
      code: result.set
        ? result.purpose === 'suspension'
          ? 'CREDENTIAL_SUSPENDED'
          : 'CREDENTIAL_REVOKED'
        : 'STATUS_CLEAR',
      evidence: [
        { labelKey: 'evidence.listVersion', value: String(result.version), kind: 'version' },
      ],
    });

    checks.push({
      id: 'status_list_anchored',
      outcome: result.listHashMatchesChain ? 'pass' : 'warn',
      code: result.listHashMatchesChain
        ? result.fresh
          ? 'LIST_MATCHES_CHAIN'
          : 'LIST_MATCHES_CHAIN_BUT_STALE'
        : result.pendingAnchor
          ? // Signed and strictly newer than the anchor: a revocation whose
            // anchoring transaction has not confirmed. Honoured, but flagged.
            'LIST_ANCHOR_PENDING'
          : chainReachable
            ? 'LIST_NOT_ANCHORED'
            : 'CHAIN_UNREACHABLE',
      evidence: [{ labelKey: 'evidence.listHash', value: result.payload.listHash, kind: 'hash' }],
    });

    return {
      revoked,
      suspended,
      listVersion: result.version,
      listHashMatchesChain: result.listHashMatchesChain,
      pendingAnchor: result.pendingAnchor,
      listAgeSeconds: result.ageSeconds,
      fresh: result.fresh,
    };
  } catch (error) {
    const code = error instanceof StatusListError ? error.code : 'STATUS_LIST_INVALID';
    // A status list that fails its own integrity checks — a rollback, a hash
    // mismatch, a bad signature — is evidence of tampering, not a soft warning.
    checks.push({ id: 'status', outcome: 'fail', code });
    checks.push({ id: 'status_list_anchored', outcome: 'fail', code });
    return {
      revoked: false,
      suspended: false,
      listHashMatchesChain: false,
      pendingAnchor: false,
      fresh: false,
    };
  }
}

function decide(args: {
  status: StatusSummary;
  anchorProof: CheckOutcome;
  issuerStatus: string;
  checks: Check[];
}): { result: VerificationResult; failureCode?: string } {
  const { status, anchorProof, checks } = args;

  if (status.revoked) return { result: 'revoked', failureCode: 'CREDENTIAL_REVOKED' };
  if (status.suspended) return { result: 'suspended', failureCode: 'CREDENTIAL_SUSPENDED' };
  if (anchorProof === 'fail') return { result: 'invalid', failureCode: 'ANCHOR_NOT_INCLUDED' };

  const failed = checks.find((c) => c.outcome === 'fail');
  if (failed) return { result: 'invalid', failureCode: failed.code };

  // Anything we could not complete leaves the answer open. Failing closed is
  // the whole point: an unreachable chain is not a clean bill of health.
  const warned = checks.find((c) => c.outcome === 'warn' && c.id !== 'issuer_known');
  if (warned) return { result: 'undetermined', failureCode: warned.code };

  return { result: 'valid' };
}

function summarise(verified: VerifiedCredential): CredentialSummary {
  const payload = verified.payload as Record<string, unknown>;
  const evidence = (payload['evidence'] ?? {}) as Record<string, unknown>;
  const exp = payload['exp'];

  return {
    vct: String(payload['vct']),
    vctRecognised: verified.vctRecognised,
    issuedAt: new Date(Number(payload['iat']) * 1000).toISOString(),
    expiresAt: typeof exp === 'number' ? new Date(exp * 1000).toISOString() : null,
    assuranceLevel: payload['assurance_level'] as CredentialSummary['assuranceLevel'],
    evidence: {
      method: String(evidence['method'] ?? 'UNKNOWN'),
      sourceSystem: String(evidence['source_system'] ?? ''),
      checkedAt: String(evidence['checked_at'] ?? ''),
      checkedByRole: String(evidence['checked_by_role'] ?? ''),
      ...(typeof evidence['note'] === 'string' ? { note: evidence['note'] } : {}),
    },
  };
}

/** Read `iss` and `iat` from the unverified payload, to find the right key. */
function peekIssuer(sdJwt: string): { iss: string; iat: number } {
  const { jwt } = parseSdJwt(sdJwt);
  const segment = jwt.split('.')[1];
  if (!segment) throw new CredentialError('MALFORMED_JWT', 'credential has no payload');
  const payload = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
  const iss = payload['iss'];
  const iat = payload['iat'];
  if (typeof iss !== 'string' || typeof iat !== 'number') {
    throw new CredentialError('MALFORMED_JWT', 'credential has no issuer or issuance time');
  }
  return { iss, iat };
}

/** Status list URIs end in /{orgSlug}/{listId}. */
function parseListId(uri: string): number | undefined {
  const match = /\/(\d+)\/?$/.exec(uri);
  if (!match?.[1]) return undefined;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function readString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
}

// --- terminal outcomes ------------------------------------------------------

const EMPTY_CREDENTIAL: CredentialSummary = {
  vct: '',
  vctRecognised: false,
  issuedAt: '',
  expiresAt: null,
  assuranceLevel: 'AL0',
  evidence: { method: 'UNKNOWN', sourceSystem: '', checkedAt: '', checkedByRole: '' },
};

function shell(
  checkedAt: string,
  issuers: IssuerDirectory,
  checks: Check[],
  iss: string,
  result: VerificationResult,
  failureCode: string,
  issuer?: IssuerResolution,
): VerificationReport {
  return {
    result,
    checkedAt,
    basis: issuers.basis,
    ...(issuers.snapshotAt === undefined
      ? {}
      : { registrySnapshotAt: new Date(issuers.snapshotAt * 1000).toISOString() }),
    issuer: {
      iss,
      ...(issuer ? { orgId: issuer.orgId, didWeb: issuer.didWeb } : {}),
      name: issuer?.name ?? '',
      accreditation: issuer?.accreditation ?? 'UNKNOWN',
      status: issuer?.status ?? 'UNKNOWN',
      keyValidAtSigning: issuer?.validAtSigningTime ?? false,
      ...(issuer?.revocationReason === undefined
        ? {}
        : { keyRevocationReason: issuer.revocationReason }),
    },
    credential: EMPTY_CREDENTIAL,
    claims: {},
    withheldClaims: [],
    status: {
      revoked: false,
      suspended: false,
      listHashMatchesChain: false,
      pendingAnchor: false,
      fresh: false,
    },
    integrity: { signature: 'fail', anchorProof: 'skipped' },
    holderBinding: 'not_presented',
    checks,
    failureCode,
  };
}

function malformed(
  checkedAt: string,
  issuers: IssuerDirectory,
  error: unknown,
): VerificationReport {
  const code = error instanceof CredentialError ? error.code : 'MALFORMED_CREDENTIAL';
  return shell(
    checkedAt,
    issuers,
    [{ id: 'signature', outcome: 'fail', code }],
    '',
    'invalid',
    code,
  );
}

function unknownIssuer(
  checkedAt: string,
  issuers: IssuerDirectory,
  checks: Check[],
  iss: string,
): VerificationReport {
  return shell(checkedAt, issuers, checks, iss, 'unknown_issuer', 'ISSUER_NOT_IN_REGISTRY');
}

function undetermined(
  checkedAt: string,
  issuers: IssuerDirectory,
  checks: Check[],
  iss: string,
  code: string,
): VerificationReport {
  return shell(checkedAt, issuers, checks, iss, 'undetermined', code);
}

function cryptoFailure(
  checkedAt: string,
  issuers: IssuerDirectory,
  checks: Check[],
  issuer: IssuerResolution,
  error: unknown,
): VerificationReport {
  const code = error instanceof CredentialError ? error.code : 'SIGNATURE_CHECK_FAILED';
  const result: VerificationResult = code === 'EXPIRED' ? 'expired' : 'invalid';

  checks.push({
    id: code === 'KEY_NOT_VALID_AT_SIGNING' ? 'issuer_key_valid_at_signing' : 'signature',
    outcome: 'fail',
    code,
    ...(issuer.revocationReason === undefined ? {} : { vars: { reason: issuer.revocationReason } }),
  });

  return shell(checkedAt, issuers, checks, '', result, code, issuer);
}
