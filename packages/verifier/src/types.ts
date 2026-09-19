/**
 * The public verification contract. PLAN.html §15.
 *
 * This shape is a contract with every integrator; version it, never reshape it
 * in place. The library deliberately does not depend on @civiledger/chain: a
 * third party plugs in their own ledger reader, or a signed registry snapshot,
 * and verifies without touching our servers (PLAN §16, move 1).
 */

import type { AssuranceLevel, JwkPublicEc } from '@civiledger/credential';

export const VERIFICATION_RESULTS = [
  'valid',
  'invalid',
  'revoked',
  'suspended',
  'expired',
  'unknown_issuer',
  'undetermined',
] as const;
export type VerificationResult = (typeof VERIFICATION_RESULTS)[number];

/**
 * The six steps of PLAN §5.3. `holder_binding` is step 6; `anchor_inclusion`
 * is step 5 and is only meaningful when the presentation carries a proof.
 */
export const CHECK_IDS = [
  'issuer_known',
  'issuer_key_valid_at_signing',
  'signature',
  'status',
  'status_list_anchored',
  'anchor_inclusion',
  'holder_binding',
] as const;
export type CheckId = (typeof CHECK_IDS)[number];

export type CheckOutcome = 'pass' | 'fail' | 'warn' | 'skipped';

/**
 * Evidence a verifier can show or forward. `value` is a hash, an address or a
 * version number — never a claim value, so a report is safe to attach to a
 * compliance file.
 */
export interface CheckEvidence {
  labelKey: string;
  value: string;
  kind: 'hash' | 'address' | 'version' | 'timestamp' | 'text';
}

export interface Check {
  id: CheckId;
  outcome: CheckOutcome;
  /**
   * A stable machine code. No user-facing English is produced by this library —
   * clients translate these, so the same result reads correctly in Bangla.
   */
  code: string;
  /** Interpolation values for the client's translation of `code`. */
  vars?: Record<string, string | number>;
  evidence?: CheckEvidence[];
}

export interface IssuerSummary {
  /** The `iss` value the credential carries. */
  iss: string;
  orgId?: string;
  name: string;
  accreditation: string;
  status: string;
  didWeb?: string;
  /** Whether the signing key was valid at the credential's `iat`. */
  keyValidAtSigning: boolean;
  keyRevocationReason?: string;
}

export interface CredentialSummary {
  vct: string;
  /** False when this build does not know the type; claims are then opaque. */
  vctRecognised: boolean;
  issuedAt: string;
  expiresAt: string | null;
  assuranceLevel: AssuranceLevel;
  evidence: {
    method: string;
    sourceSystem: string;
    checkedAt: string;
    checkedByRole: string;
    note?: string;
  };
}

export interface StatusSummary {
  revoked: boolean;
  suspended: boolean;
  listVersion?: number;
  listHashMatchesChain: boolean;
  /** True when the list is newer than its anchor — a publish in flight. */
  pendingAnchor?: boolean;
  /** Seconds since the status list was signed. */
  listAgeSeconds?: number;
  fresh: boolean;
}

export interface VerificationReport {
  result: VerificationResult;
  /** ISO-8601. */
  checkedAt: string;
  /**
   * `live` when the registry was read from the chain during this check;
   * `cached` when it came from a snapshot. A cached result is ALWAYS labelled
   * as cached, with its freshness window (invariant §25).
   */
  basis: 'live' | 'cached';
  /** ISO-8601 age of the registry snapshot, when `basis` is `cached`. */
  registrySnapshotAt?: string;
  issuer: IssuerSummary;
  credential: CredentialSummary;
  /** Only the claims the holder chose to disclose. */
  claims: Record<string, unknown>;
  /** Names of claims of this type that were withheld. */
  withheldClaims: string[];
  status: StatusSummary;
  integrity: {
    signature: CheckOutcome;
    anchorProof: CheckOutcome;
    anchorBatchId?: string;
  };
  holderBinding: 'verified' | 'not_presented' | 'invalid';
  checks: Check[];
  /** A machine code explaining a non-`valid` result. */
  failureCode?: string;
}

// ---------------------------------------------------------------
// Ports — supply these from a live chain, or from a signed snapshot
// ---------------------------------------------------------------

export interface IssuerResolution {
  orgId: string;
  name: string;
  didWeb: string;
  accreditation: string;
  status: string;
  /** The public key for the epoch covering the credential's signing time. */
  jwk: JwkPublicEc;
  keyThumbprint: string;
  validAtSigningTime: boolean;
  revocationReason?: string;
}

export interface IssuerDirectory {
  /** `live` reads the chain; `cached` reads a signed registry snapshot. */
  readonly basis: 'live' | 'cached';
  /** Seconds since epoch the snapshot was taken. Required when cached. */
  readonly snapshotAt?: number;
  /** Returns undefined when the issuer is not in the registry at all. */
  resolve(iss: string, signedAtSeconds: number): Promise<IssuerResolution | undefined>;
}

export interface OnChainStatusListRecord {
  listHash: string;
  uri: string;
  version: number;
  updatedAt: number;
}

export interface StatusListSource {
  /** Fetch the signed status list JWT published at `uri`. */
  fetch(uri: string): Promise<string | undefined>;
  /**
   * What the chain records for this list. Returning undefined means the check
   * degrades to `warn` — never to `pass`.
   */
  onChain(orgId: string, listId: number): Promise<OnChainStatusListRecord | undefined>;
}

/** Anchor inclusion proof, carried with the presentation. */
export interface AnchorProof {
  batchId: string;
  leaf: string;
  proof: string[];
}

export interface AnchorSource {
  verify(proof: AnchorProof): Promise<boolean>;
}

export class VerificationError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'VerificationError';
    this.code = code;
  }
}
