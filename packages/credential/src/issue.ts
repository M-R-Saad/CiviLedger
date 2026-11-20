/**
 * Issue an SD-JWT VC. PLAN.html §8.
 *
 * Every claim carrying personal data is selectively disclosable. The always-
 * visible block (issuer name, accreditation, assurance level, evidence) is
 * deliberately NOT disclosable: a verifier must never be able to receive a
 * credential without also seeing how rigorously it was checked (invariant §25).
 */

import { encodeBase64Url } from './base64url.js';
import { createDecoyDigests, createDisclosure, SD_ALG, systemRandom } from './disclosure.js';
import type { RandomSource } from './disclosure.js';
import type { CredentialSigner } from './signer.js';
import {
  CredentialError,
  type AlwaysVisibleClaims,
  type Disclosure,
  type IssuedCredential,
  type JwkPublicEc,
  type StatusClaim,
} from './types.js';
import { requireCredentialType, validateClaims } from './vct.js';

/** SD-JWT VC media type. Older drafts used `vc+sd-jwt`; we accept both on verify. */
export const SD_JWT_VC_TYP = 'dc+sd-jwt';

export interface IssueOptions {
  /** Issuer identifier — an https URL serving issuer metadata. */
  iss: string;
  vct: string;
  /** The selectively-disclosable claims, validated against the frozen vct. */
  claims: Record<string, unknown>;
  alwaysVisible: AlwaysVisibleClaims;
  /** Holder binding key. Omit only for credentials never presented by a person. */
  holderJwk?: JwkPublicEc;
  status?: StatusClaim;
  /** Seconds since epoch. Injected, never read from a clock inside this package. */
  issuedAt: number;
  /** Seconds since epoch, or null where the type does not expire. */
  expiresAt: number | null;
  notBefore?: number;
  /**
   * Decoy digests padded into `_sd` so a verifier cannot count withheld claims.
   * Defaults to 4; set 0 in tests that assert on exact `_sd` contents.
   */
  decoyCount?: number;
  random?: RandomSource;
  signer: CredentialSigner;
}

export async function issueCredential(options: IssueOptions): Promise<IssuedCredential> {
  const {
    iss,
    vct,
    claims,
    alwaysVisible,
    holderJwk,
    status,
    issuedAt,
    expiresAt,
    notBefore,
    decoyCount = 4,
    random = systemRandom,
    signer,
  } = options;

  const definition = requireCredentialType(vct);

  const issues = validateClaims(vct, claims);
  if (issues.length > 0) {
    throw new CredentialError(
      'CLAIMS_INVALID',
      `claims do not satisfy ${vct}: ${issues.map((i) => `${i.claim} ${i.message}`).join('; ')}`,
    );
  }

  if (definition.expires && expiresAt === null) {
    throw new CredentialError('EXPIRY_REQUIRED', `${vct} credentials must carry an expiry`);
  }
  if (!definition.expires && expiresAt !== null) {
    throw new CredentialError('EXPIRY_NOT_ALLOWED', `${vct} credentials do not expire`);
  }
  if (expiresAt !== null && expiresAt <= issuedAt) {
    throw new CredentialError('EXPIRY_IN_PAST', 'expiry must be after issuance');
  }
  if (alwaysVisible.assurance_level === 'AL0') {
    // AL0 is the code's floor value; it must never reach a published credential.
    throw new CredentialError('ASSURANCE_TOO_LOW', 'AL0 credentials must not be published');
  }

  const disclosures: Disclosure[] = [];
  for (const claim of definition.disclosableClaims) {
    const value = claims[claim.name];
    if (value === undefined || value === null || value === '') continue;
    disclosures.push(createDisclosure(claim.name, value, random));
  }

  // Sorting hides the issuer's claim ordering, which would otherwise leak which
  // digest is which for a known vct.
  const sd = [
    ...disclosures.map((d) => d.digest),
    ...createDecoyDigests(decoyCount, random),
  ].sort();

  const payload: Record<string, unknown> = {
    iss,
    vct,
    iat: issuedAt,
    exp: expiresAt,
    _sd_alg: SD_ALG,
    _sd: sd,
    issuer_name: alwaysVisible.issuer_name,
    accreditation: alwaysVisible.accreditation,
    assurance_level: alwaysVisible.assurance_level,
    evidence: alwaysVisible.evidence,
  };
  if (notBefore !== undefined) payload['nbf'] = notBefore;
  if (holderJwk) payload['cnf'] = { jwk: holderJwk };
  if (status) payload['status'] = status;

  const header: Record<string, unknown> = { alg: signer.alg, typ: SD_JWT_VC_TYP };
  if (signer.kid !== undefined) header['kid'] = signer.kid;

  const signingInput = `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(
    JSON.stringify(payload),
  )}`;
  const signature = await signer.sign(new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${encodeBase64Url(signature)}`;

  // Compact SD-JWT always ends in `~` when no key-binding JWT is attached.
  const sdJwt = `${jwt}~${disclosures.map((d) => d.encoded).join('~')}${disclosures.length > 0 ? '~' : ''}`;

  return { sdJwt, jwt, disclosures, signedPayload: payload };
}
