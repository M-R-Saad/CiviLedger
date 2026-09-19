/**
 * SD-JWT disclosure mechanics — IETF draft-ietf-oauth-selective-disclosure-jwt.
 *
 * A disclosure is base64url(JSON.stringify([salt, claimName, claimValue])).
 * Its digest is base64url(SHA-256(ASCII(<that exact string>))).
 *
 * The digest is taken over the *encoded string*, never over a re-serialisation
 * of the decoded array. A verifier that re-serialises will compute a different
 * digest for semantically identical JSON and reject valid credentials, so
 * `parseDisclosure` deliberately keeps the original string around.
 */

import { createHash, randomBytes } from 'node:crypto';
import { decodeBase64UrlToString, encodeBase64Url, isBase64Url } from './base64url.js';
import { CredentialError, type Disclosure } from './types.js';

/** The only `_sd_alg` we issue or accept. */
export const SD_ALG = 'sha-256' as const;

/** 128 bits, per the spec's minimum recommendation. */
const SALT_BYTES = 16;

/** Injectable randomness so tests can be deterministic. */
export interface RandomSource {
  /** Returns `n` random bytes. */
  bytes(n: number): Uint8Array;
}

export const systemRandom: RandomSource = {
  bytes: (n) => new Uint8Array(randomBytes(n)),
};

export function digestOf(encodedDisclosure: string): string {
  return createHash('sha256').update(encodedDisclosure, 'ascii').digest('base64url');
}

/** Build a disclosure for one object property. */
export function createDisclosure(
  claimName: string,
  claimValue: unknown,
  random: RandomSource = systemRandom,
): Disclosure {
  if (claimName === '_sd' || claimName === '_sd_alg' || claimName === '...') {
    throw new CredentialError('RESERVED_CLAIM_NAME', `"${claimName}" is a reserved claim name`);
  }
  if (claimValue === undefined) {
    throw new CredentialError(
      'UNDEFINED_CLAIM_VALUE',
      `claim "${claimName}" is undefined; omit it instead of disclosing it`,
    );
  }
  const salt = encodeBase64Url(random.bytes(SALT_BYTES));
  const encoded = encodeBase64Url(JSON.stringify([salt, claimName, claimValue]));
  return { encoded, salt, claimName, claimValue, digest: digestOf(encoded) };
}

/**
 * Decoy digests. Without them a verifier can count how many claims were
 * withheld, which leaks the shape of the credential. PLAN §17, correlation row.
 */
export function createDecoyDigests(count: number, random: RandomSource = systemRandom): string[] {
  const decoys: string[] = [];
  for (let i = 0; i < count; i += 1) {
    decoys.push(encodeBase64Url(random.bytes(32)));
  }
  return decoys;
}

/** Parse a disclosure string received from a holder. Never trusts its shape. */
export function parseDisclosure(encoded: string): Disclosure {
  if (!isBase64Url(encoded)) {
    throw new CredentialError('MALFORMED_DISCLOSURE', 'disclosure is not base64url');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64UrlToString(encoded));
  } catch {
    throw new CredentialError('MALFORMED_DISCLOSURE', 'disclosure is not valid JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new CredentialError('MALFORMED_DISCLOSURE', 'disclosure is not a JSON array');
  }
  // Array-element disclosures ([salt, value]) are valid SD-JWT but no vct we
  // publish uses them. Rejecting keeps the claim-scope check in verify.ts total.
  if (parsed.length !== 3) {
    throw new CredentialError(
      'UNSUPPORTED_DISCLOSURE',
      'only 3-element object-property disclosures are supported',
    );
  }

  const [salt, claimName, claimValue] = parsed as [unknown, unknown, unknown];
  if (typeof salt !== 'string' || salt.length === 0) {
    throw new CredentialError('MALFORMED_DISCLOSURE', 'disclosure salt is not a string');
  }
  if (typeof claimName !== 'string' || claimName.length === 0) {
    throw new CredentialError('MALFORMED_DISCLOSURE', 'disclosure claim name is not a string');
  }

  return { encoded, salt, claimName, claimValue, digest: digestOf(encoded) };
}
