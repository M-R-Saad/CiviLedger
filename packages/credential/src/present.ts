/**
 * Holder-side presentation: choose a claim scope, attach key binding.
 *
 * Claim scope is also enforced server-side before a presentation is released
 * (invariant §25) — this function is the holder's half of that, not the only
 * gate. A verifier must never receive a claim it did not request and justify.
 */

import { encodeBase64Url } from './base64url.js';
import { digestOf, parseDisclosure } from './disclosure.js';
import type { CredentialSigner } from './signer.js';
import { CredentialError, type Disclosure } from './types.js';

export interface ParsedSdJwt {
  jwt: string;
  disclosures: Disclosure[];
  /** Present only when the holder attached a key-binding JWT. */
  keyBindingJwt?: string;
}

/**
 * Split a compact SD-JWT into its parts.
 *
 * Format: <jwt>~<d1>~<d2>~...~<kb-jwt>?  — the final segment is the KB-JWT when
 * non-empty, and empty when no key binding is attached.
 */
export function parseSdJwt(compact: string): ParsedSdJwt {
  const trimmed = compact.trim();
  if (trimmed.length === 0) {
    throw new CredentialError('MALFORMED_SD_JWT', 'empty credential');
  }
  const parts = trimmed.split('~');
  if (parts.length < 2) {
    throw new CredentialError(
      'MALFORMED_SD_JWT',
      'not a compact SD-JWT — expected at least one "~" separator',
    );
  }

  const jwt = parts[0] ?? '';
  if (jwt.split('.').length !== 3) {
    throw new CredentialError('MALFORMED_SD_JWT', 'issuer-signed JWT is not a compact JWS');
  }

  const last = parts[parts.length - 1] ?? '';
  const disclosureParts = parts.slice(1, parts.length - 1);
  const disclosures = disclosureParts.map((d) => parseDisclosure(d));

  const seen = new Set<string>();
  for (const d of disclosures) {
    if (seen.has(d.digest)) {
      throw new CredentialError('DUPLICATE_DISCLOSURE', 'the same disclosure was sent twice');
    }
    seen.add(d.digest);
  }

  return last === '' ? { jwt, disclosures } : { jwt, disclosures, keyBindingJwt: last };
}

export interface PresentOptions {
  /** The credential as issued, including every disclosure. */
  issuedSdJwt: string;
  /** Claim names the verifier requested. Anything else is withheld. */
  claimScope: readonly string[];
  keyBinding?: KeyBindingOptions;
}

export interface KeyBindingOptions {
  /** The verifier's identifier, echoed into `aud`. */
  audience: string;
  /** Verifier-supplied nonce; replay defence. */
  nonce: string;
  /** Seconds since epoch. */
  issuedAt: number;
  /** Signs with the holder key named in the credential's `cnf` claim. */
  signer: CredentialSigner;
}

/** Key-binding JWT media type, per SD-JWT. */
export const KB_JWT_TYP = 'kb+jwt';

/**
 * Produce a presentation limited to `claimScope`, optionally key-bound.
 *
 * Requesting a claim the credential does not carry is silently ignored rather
 * than an error: a verifier may legitimately ask for an optional claim that
 * this particular graduate's record does not have.
 */
export async function presentCredential(options: PresentOptions): Promise<string> {
  const { issuedSdJwt, claimScope, keyBinding } = options;
  const parsed = parseSdJwt(issuedSdJwt);

  const scope = new Set(claimScope);
  const selected = parsed.disclosures.filter((d) => scope.has(d.claimName));

  const body = [parsed.jwt, ...selected.map((d) => d.encoded)].join('~');
  // Always terminate with `~` so the KB-JWT slot exists, per the compact format.
  const withoutKb = `${body}~`;

  if (!keyBinding) return withoutKb;

  const sdHash = digestOf(withoutKb);
  const header = { alg: keyBinding.signer.alg, typ: KB_JWT_TYP };
  const payload = {
    iat: keyBinding.issuedAt,
    aud: keyBinding.audience,
    nonce: keyBinding.nonce,
    sd_hash: sdHash,
  };
  const signingInput = `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(
    JSON.stringify(payload),
  )}`;
  const signature = await keyBinding.signer.sign(new TextEncoder().encode(signingInput));
  return `${withoutKb}${signingInput}.${encodeBase64Url(signature)}`;
}
