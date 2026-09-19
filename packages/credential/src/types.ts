/**
 * Core credential types. See PLAN.html §8 (credential format) and §13 (identity binding).
 *
 * Nothing in this file may reference a database, a network client, or a clock
 * that is not passed in. The package is pure so that the open-source verifier
 * library can embed it (PLAN §16, move 1).
 */

/** RFC 7517 JSON Web Key, narrowed to what we actually accept. */
export interface JwkPublicEc {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
  alg?: 'ES256';
  kid?: string;
  use?: 'sig';
}

/**
 * Assurance level — how rigorously the subject and record were checked.
 * PLAN §13. This is surfaced in every verification result; never hide it.
 */
export const ASSURANCE_LEVELS = ['AL0', 'AL1', 'AL2', 'AL3', 'AL3+'] as const;
export type AssuranceLevel = (typeof ASSURANCE_LEVELS)[number];

/** How the issuer satisfied itself that the record is real. PLAN §5.2. */
export const EVIDENCE_METHODS = [
  'SELF_ASSERTED',
  'DOCUMENT_SCAN_OCR',
  'REGISTRAR_SOURCE_CHECK',
  'SYSTEM_OF_RECORD_SYNC',
  'SYSTEM_OF_RECORD_SYNC_WITH_ID_CHECK',
] as const;
export type EvidenceMethod = (typeof EVIDENCE_METHODS)[number];

export interface CredentialEvidence {
  method: EvidenceMethod;
  /** Name of the institutional system the record was read from, e.g. "UIU SIS". */
  source_system: string;
  /** ISO-8601 date (YYYY-MM-DD) the check was performed. */
  checked_at: string;
  /** Role, never a person's name — this block is visible to every verifier. */
  checked_by_role: string;
  /** Free-text qualifier, e.g. "matched against 2014 convocation ledger, vol. 3". */
  note?: string;
}

export const ACCREDITATIONS = [
  'SELF_ASSERTED',
  'PROFESSIONAL_BODY',
  'BOARD',
  'UGC_RECOGNIZED',
] as const;
export type Accreditation = (typeof ACCREDITATIONS)[number];

/** W3C Bitstring Status List reference embedded in the credential. */
export interface StatusClaim {
  status_list: {
    idx: number;
    uri: string;
  };
}

/** Claims every verifier always sees, regardless of selective disclosure. */
export interface AlwaysVisibleClaims {
  issuer_name: string;
  accreditation: Accreditation;
  assurance_level: AssuranceLevel;
  evidence: CredentialEvidence;
}

/**
 * The issuer-signed JWT payload, before disclosure processing replaces the
 * selectively-disclosable claims with digests.
 */
export interface CredentialPayload extends AlwaysVisibleClaims {
  /** Issuer identifier — an https URL that resolves to issuer metadata. */
  iss: string;
  /** Verifiable credential type. Frozen and versioned; see vct.ts. */
  vct: string;
  /** Issued-at, seconds since epoch. */
  iat: number;
  /** Expiry, seconds since epoch. null for credentials that do not expire. */
  exp: number | null;
  /** Not-before, seconds since epoch. Optional. */
  nbf?: number;
  /** Holder binding key confirmation. PLAN §13. */
  cnf?: { jwk: JwkPublicEc };
  status?: StatusClaim;
}

/** A single decoded disclosure: [salt, claimName, claimValue]. */
export interface Disclosure {
  /** Base64url-encoded JSON array — the exact string the digest is computed over. */
  encoded: string;
  salt: string;
  /** Undefined for array-element disclosures, which we do not currently emit. */
  claimName: string;
  claimValue: unknown;
  /** base64url(sha-256(ascii(encoded))) */
  digest: string;
}

/** An issued credential, ready to be stored by the issuer and handed to the holder. */
export interface IssuedCredential {
  /** Compact SD-JWT: <jwt>~<disclosure>~...~ (trailing tilde, no KB-JWT). */
  sdJwt: string;
  /** The signed JWT alone, without disclosures. */
  jwt: string;
  disclosures: Disclosure[];
  /** The payload as signed, with `_sd` digests in place of disclosed claims. */
  signedPayload: Record<string, unknown>;
}

/** Result of verifying an SD-JWT VC's cryptography and reassembling its claims. */
export interface VerifiedCredential {
  payload: CredentialPayload & Record<string, unknown>;
  /** Claims the presenter actually disclosed, merged into a flat object. */
  disclosedClaims: Record<string, unknown>;
  /** Names of selectively-disclosable claims that were withheld. */
  withheldClaimNames: string[];
  /**
   * Whether this build knows the credential's `vct`. False means the signature
   * is good but we cannot describe the claims or compute what was withheld —
   * the verification result must say so rather than imply completeness.
   */
  vctRecognised: boolean;
  /** Whether a key-binding JWT was present and valid. */
  holderBinding: 'verified' | 'not_presented' | 'invalid';
  /** Key-binding audience and nonce, when a KB-JWT was presented. */
  keyBinding?: { audience: string; nonce: string; issuedAt: number };
}

export class CredentialError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'CredentialError';
    this.code = code;
  }
}
