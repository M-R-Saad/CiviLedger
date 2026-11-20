/**
 * Cryptographic verification of an SD-JWT VC presentation.
 *
 * This covers steps 1, 2 and 6 of the six-step check in PLAN.html §5.3 —
 * issuer key valid AT SIGNING TIME, signature over the disclosed claims, and
 * holder binding. Steps 3–5 (status bit, status-list hash, anchor inclusion)
 * need a registry and a status list, and live in @civiledger/verifier.
 *
 * `resolveIssuerKey` is injected so this package stays pure: the caller decides
 * whether the key came from a live chain read or a cached registry snapshot.
 */

import { compactVerify, importJWK } from 'jose';
import { decodeBase64UrlToString } from './base64url.js';
import { digestOf } from './disclosure.js';
import { parseSdJwt } from './present.js';
import { KB_JWT_TYP } from './present.js';
import { SD_JWT_VC_TYP } from './issue.js';
import {
  CredentialError,
  type CredentialPayload,
  type JwkPublicEc,
  type VerifiedCredential,
} from './types.js';
import { getCredentialType } from './vct.js';

/** Media types we accept for the issuer-signed JWT. */
const ACCEPTED_TYP = new Set([SD_JWT_VC_TYP, 'vc+sd-jwt']);

export interface IssuerKeyResolution {
  jwk: JwkPublicEc;
  /** RFC 7638 thumbprint the registry holds for this epoch. */
  thumbprint: string;
  /**
   * Whether the registry says this key was valid at the credential's `iat`.
   * False means the key had been revoked or had not yet come into force —
   * the credential is then rejected regardless of a good signature.
   */
  validAtSigningTime: boolean;
  /** Non-empty when the key epoch was cut short. Surfaced in the result. */
  revocationReason?: string;
}

export interface VerifyOptions {
  /** Compact SD-JWT presentation, optionally with a key-binding JWT. */
  sdJwt: string;
  resolveIssuerKey(params: {
    iss: string;
    kid?: string;
    /** The credential's `iat`, in seconds — this is what `keyAt()` takes. */
    issuedAt: number;
  }): Promise<IssuerKeyResolution>;
  /** Seconds since epoch. Injected so verification is deterministic in tests. */
  now: number;
  clockSkewSeconds?: number;
  /** Required when the verifier demanded holder binding. */
  expectedAudience?: string;
  expectedNonce?: string;
  requireKeyBinding?: boolean;
  /** How old a key-binding JWT may be. Default 5 minutes. */
  keyBindingMaxAgeSeconds?: number;
}

export async function verifyCredential(options: VerifyOptions): Promise<VerifiedCredential> {
  const {
    sdJwt,
    resolveIssuerKey,
    now,
    clockSkewSeconds = 60,
    expectedAudience,
    expectedNonce,
    requireKeyBinding = false,
    keyBindingMaxAgeSeconds = 300,
  } = options;

  const parsed = parseSdJwt(sdJwt);
  const { header, payload } = decodeJwt(parsed.jwt);

  if (typeof header['alg'] !== 'string' || header['alg'] !== 'ES256') {
    throw new CredentialError('UNSUPPORTED_ALG', 'only ES256 is accepted');
  }
  const typ = header['typ'];
  if (typeof typ !== 'string' || !ACCEPTED_TYP.has(typ)) {
    throw new CredentialError('UNSUPPORTED_TYP', `unexpected JWT typ "${String(typ)}"`);
  }

  const iss = payload['iss'];
  const vct = payload['vct'];
  const iat = payload['iat'];
  if (typeof iss !== 'string' || iss.length === 0) {
    throw new CredentialError('MISSING_ISS', 'credential has no issuer');
  }
  if (typeof vct !== 'string' || vct.length === 0) {
    throw new CredentialError('MISSING_VCT', 'credential has no type');
  }
  if (typeof iat !== 'number' || !Number.isFinite(iat)) {
    throw new CredentialError('MISSING_IAT', 'credential has no issuance time');
  }
  if (iat > now + clockSkewSeconds) {
    throw new CredentialError('ISSUED_IN_FUTURE', 'credential claims to be issued in the future');
  }

  const kid = typeof header['kid'] === 'string' ? header['kid'] : undefined;
  const resolution = await resolveIssuerKey(
    kid === undefined ? { iss, issuedAt: iat } : { iss, kid, issuedAt: iat },
  );

  // Signature first: a bad signature means the payload, including `iat`, is
  // not evidence of anything.
  const key = await importJWK(resolution.jwk as never, 'ES256');
  try {
    await compactVerify(parsed.jwt, key, { algorithms: ['ES256'] });
  } catch {
    throw new CredentialError('BAD_SIGNATURE', 'issuer signature does not verify');
  }

  if (!resolution.validAtSigningTime) {
    throw new CredentialError(
      'KEY_NOT_VALID_AT_SIGNING',
      resolution.revocationReason
        ? `issuer key was not valid when this credential was signed (${resolution.revocationReason})`
        : 'issuer key was not valid when this credential was signed',
    );
  }

  if (payload['_sd_alg'] !== undefined && payload['_sd_alg'] !== 'sha-256') {
    throw new CredentialError('UNSUPPORTED_SD_ALG', 'only sha-256 digests are accepted');
  }

  const nbf = payload['nbf'];
  if (typeof nbf === 'number' && now + clockSkewSeconds < nbf) {
    throw new CredentialError('NOT_YET_VALID', 'credential is not valid yet');
  }
  const exp = payload['exp'];
  if (typeof exp === 'number' && now - clockSkewSeconds >= exp) {
    throw new CredentialError('EXPIRED', 'credential has expired');
  }

  // Every disclosure presented must match a digest the issuer signed. An
  // unmatched disclosure means someone appended a claim after issuance.
  const sdDigests = new Set(readStringArray(payload['_sd']));
  const disclosedClaims: Record<string, unknown> = {};
  for (const disclosure of parsed.disclosures) {
    if (!sdDigests.has(disclosure.digest)) {
      throw new CredentialError(
        'UNMATCHED_DISCLOSURE',
        `disclosure for "${disclosure.claimName}" is not one the issuer signed`,
      );
    }
    if (Object.prototype.hasOwnProperty.call(disclosedClaims, disclosure.claimName)) {
      throw new CredentialError(
        'DUPLICATE_CLAIM',
        `claim "${disclosure.claimName}" was disclosed twice`,
      );
    }
    disclosedClaims[disclosure.claimName] = disclosure.claimValue;
  }

  const definition = getCredentialType(vct);
  const withheldClaimNames = definition
    ? definition.disclosableClaims
        .map((c) => c.name)
        .filter((name) => !Object.prototype.hasOwnProperty.call(disclosedClaims, name))
    : [];

  const holderResult = await verifyKeyBinding({
    parsed,
    payload,
    now,
    clockSkewSeconds,
    requireKeyBinding,
    keyBindingMaxAgeSeconds,
    ...(expectedAudience === undefined ? {} : { expectedAudience }),
    ...(expectedNonce === undefined ? {} : { expectedNonce }),
  });

  return {
    payload: payload as CredentialPayload & Record<string, unknown>,
    disclosedClaims,
    withheldClaimNames,
    vctRecognised: definition !== undefined,
    holderBinding: holderResult.status,
    ...(holderResult.keyBinding ? { keyBinding: holderResult.keyBinding } : {}),
  };
}

interface KeyBindingCheck {
  status: VerifiedCredential['holderBinding'];
  keyBinding?: VerifiedCredential['keyBinding'];
}

async function verifyKeyBinding(args: {
  parsed: ReturnType<typeof parseSdJwt>;
  payload: Record<string, unknown>;
  now: number;
  clockSkewSeconds: number;
  requireKeyBinding: boolean;
  keyBindingMaxAgeSeconds: number;
  expectedAudience?: string;
  expectedNonce?: string;
}): Promise<KeyBindingCheck> {
  const { parsed, payload, now, clockSkewSeconds, requireKeyBinding, keyBindingMaxAgeSeconds } =
    args;

  if (!parsed.keyBindingJwt) {
    if (requireKeyBinding) {
      throw new CredentialError('KEY_BINDING_REQUIRED', 'this verifier requires holder binding');
    }
    return { status: 'not_presented' };
  }

  const cnf = payload['cnf'];
  const holderJwk = cnf && typeof cnf === 'object' ? (cnf as { jwk?: unknown }).jwk : undefined;
  if (!holderJwk) {
    throw new CredentialError(
      'NO_HOLDER_KEY',
      'a key-binding JWT was presented but the credential has no cnf key',
    );
  }

  const { header: kbHeader, payload: kbPayload } = decodeJwt(parsed.keyBindingJwt);
  if (kbHeader['typ'] !== KB_JWT_TYP) {
    throw new CredentialError('BAD_KEY_BINDING', 'key-binding JWT has the wrong typ');
  }
  if (kbHeader['alg'] !== 'ES256') {
    throw new CredentialError('BAD_KEY_BINDING', 'key-binding JWT must use ES256');
  }

  const key = await importJWK(holderJwk as never, 'ES256');
  try {
    await compactVerify(parsed.keyBindingJwt, key, { algorithms: ['ES256'] });
  } catch {
    throw new CredentialError('BAD_KEY_BINDING', 'key-binding signature does not verify');
  }

  // sd_hash binds the KB-JWT to this exact set of disclosures, so a captured
  // KB-JWT cannot be replayed against a different claim scope.
  const rebuilt = `${[parsed.jwt, ...parsed.disclosures.map((d) => d.encoded)].join('~')}~`;
  if (kbPayload['sd_hash'] !== digestOf(rebuilt)) {
    throw new CredentialError(
      'BAD_KEY_BINDING',
      'key-binding JWT does not cover the presented disclosures',
    );
  }

  const aud = kbPayload['aud'];
  const nonce = kbPayload['nonce'];
  const kbIat = kbPayload['iat'];
  if (typeof aud !== 'string' || typeof nonce !== 'string' || typeof kbIat !== 'number') {
    throw new CredentialError('BAD_KEY_BINDING', 'key-binding JWT is missing aud, nonce or iat');
  }
  if (args.expectedAudience !== undefined && aud !== args.expectedAudience) {
    throw new CredentialError(
      'BAD_KEY_BINDING',
      'key-binding JWT is addressed to another verifier',
    );
  }
  if (args.expectedNonce !== undefined && nonce !== args.expectedNonce) {
    throw new CredentialError('BAD_KEY_BINDING', 'key-binding nonce does not match the challenge');
  }
  if (kbIat > now + clockSkewSeconds) {
    throw new CredentialError('BAD_KEY_BINDING', 'key-binding JWT is dated in the future');
  }
  if (now - kbIat > keyBindingMaxAgeSeconds + clockSkewSeconds) {
    throw new CredentialError(
      'BAD_KEY_BINDING',
      'key-binding JWT is too old — request a fresh one',
    );
  }

  return { status: 'verified', keyBinding: { audience: aud, nonce, issuedAt: kbIat } };
}

function decodeJwt(jwt: string): {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
} {
  const [rawHeader, rawPayload] = jwt.split('.');
  if (!rawHeader || !rawPayload) {
    throw new CredentialError('MALFORMED_JWT', 'JWT is missing a header or payload');
  }
  return {
    header: parseJsonObject(rawHeader, 'header'),
    payload: parseJsonObject(rawPayload, 'payload'),
  };
}

function parseJsonObject(segment: string, what: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(decodeBase64UrlToString(segment));
  } catch {
    throw new CredentialError('MALFORMED_JWT', `JWT ${what} is not valid JSON`);
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CredentialError('MALFORMED_JWT', `JWT ${what} is not a JSON object`);
  }
  return value as Record<string, unknown>;
}

function readStringArray(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new CredentialError('MALFORMED_SD', '_sd is not an array');
  }
  return value.filter((v): v is string => typeof v === 'string');
}
