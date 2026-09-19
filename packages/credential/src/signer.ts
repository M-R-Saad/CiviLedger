/**
 * Signing abstraction.
 *
 * Issuer signing keys are non-exportable and live in a KMS or HSM (PLAN §7.1,
 * §12.1, invariant §25). This package therefore never sees a private key — it
 * hands a signing input to a `CredentialSigner` and gets a signature back.
 * `createLocalSigner` exists for tests and for the synthetic-data devnet only.
 */

import { calculateJwkThumbprint, exportJWK, generateKeyPair } from 'jose';
import { createSign, createPrivateKey, type KeyObject } from 'node:crypto';
import { CredentialError, type JwkPublicEc } from './types.js';

export interface CredentialSigner {
  /** RFC 7638 thumbprint (base64url sha-256) of the corresponding public key. */
  readonly thumbprint: string;
  readonly alg: 'ES256';
  /** Optional `kid` header — issuers with several live epochs should set it. */
  readonly kid?: string;
  /** Sign the JWS signing input, returning a raw 64-byte R||S signature. */
  sign(signingInput: Uint8Array): Promise<Uint8Array>;
}

/**
 * RFC 7638 thumbprint of a P-256 public JWK, base64url — the JOSE form.
 *
 * The ledger stores the same 32 bytes as `bytes32`. Use `thumbprintToBytes32`
 * at that boundary; the two encodings are the same digest and must never be
 * compared to each other directly.
 */
export async function jwkThumbprint(jwk: JwkPublicEc): Promise<string> {
  return calculateJwkThumbprint(jwk as unknown as Parameters<typeof calculateJwkThumbprint>[0]);
}

/** Convert a base64url thumbprint into the 0x-prefixed bytes32 the chain holds. */
export function thumbprintToBytes32(thumbprint: string): string {
  const bytes = Buffer.from(thumbprint, 'base64url');
  if (bytes.length !== 32) {
    throw new CredentialError(
      'BAD_THUMBPRINT',
      `expected a 32-byte sha-256 thumbprint, got ${bytes.length} bytes`,
    );
  }
  return `0x${bytes.toString('hex')}`;
}

/** Convert a bytes32 thumbprint back to the base64url JOSE form. */
export function bytes32ToThumbprint(hex: string): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    throw new CredentialError('BAD_THUMBPRINT', 'expected a 0x-prefixed 32-byte hex string');
  }
  return Buffer.from(hex.slice(2), 'hex').toString('base64url');
}

/**
 * Convert a DER-encoded ECDSA signature (what node:crypto emits by default)
 * into the fixed-width R||S form JWS requires.
 */
export function derToJoseSignature(der: Uint8Array, byteLength = 32): Uint8Array {
  if (der[0] !== 0x30) {
    throw new CredentialError('BAD_SIGNATURE', 'signature is not a DER SEQUENCE');
  }
  // Skip SEQUENCE tag; the length byte may be short- or long-form.
  let offset = 1;
  const seqLen = der[offset];
  if (seqLen === undefined) throw new CredentialError('BAD_SIGNATURE', 'truncated DER signature');
  offset += seqLen & 0x80 ? 1 + (seqLen & 0x7f) : 1;

  const readInt = (): Uint8Array => {
    if (der[offset] !== 0x02) {
      throw new CredentialError('BAD_SIGNATURE', 'expected a DER INTEGER');
    }
    offset += 1;
    const len = der[offset];
    if (len === undefined) throw new CredentialError('BAD_SIGNATURE', 'truncated DER integer');
    offset += 1;
    let value = der.subarray(offset, offset + len);
    offset += len;
    // Strip the leading zero DER adds to keep the integer positive.
    while (value.length > byteLength && value[0] === 0x00) value = value.subarray(1);
    if (value.length > byteLength) {
      throw new CredentialError('BAD_SIGNATURE', 'DER integer wider than the curve');
    }
    const padded = new Uint8Array(byteLength);
    padded.set(value, byteLength - value.length);
    return padded;
  };

  const r = readInt();
  const s = readInt();
  const out = new Uint8Array(byteLength * 2);
  out.set(r, 0);
  out.set(s, byteLength);
  return out;
}

/**
 * An in-process signer. Only for tests and the synthetic-data devnet — a
 * production issuer key must never be loadable into this process.
 */
export async function createLocalSigner(
  privateJwk: unknown,
  kid?: string,
): Promise<CredentialSigner> {
  const publicJwk = await toPublicJwk(privateJwk);
  const thumbprint = await jwkThumbprint(publicJwk);
  const keyObject: KeyObject = createPrivateKey({ key: privateJwk as never, format: 'jwk' });

  return {
    thumbprint,
    alg: 'ES256',
    ...(kid === undefined ? {} : { kid }),
    async sign(signingInput: Uint8Array): Promise<Uint8Array> {
      const der = createSign('SHA256').update(signingInput).sign(keyObject);
      return derToJoseSignature(new Uint8Array(der));
    },
  };
}

/** Strip the private components from a P-256 JWK. */
export async function toPublicJwk(jwk: unknown): Promise<JwkPublicEc> {
  const source = jwk as Record<string, unknown>;
  if (source['kty'] !== 'EC' || source['crv'] !== 'P-256') {
    throw new CredentialError('UNSUPPORTED_KEY', 'only P-256 EC keys are supported');
  }
  const { x, y } = source as { x?: unknown; y?: unknown };
  if (typeof x !== 'string' || typeof y !== 'string') {
    throw new CredentialError('UNSUPPORTED_KEY', 'JWK is missing its public coordinates');
  }
  return { kty: 'EC', crv: 'P-256', x, y, alg: 'ES256' };
}

/** Generate a fresh P-256 keypair. Tests and devnet seeding only. */
export async function generateEs256KeyPair(): Promise<{
  privateJwk: Record<string, unknown>;
  publicJwk: JwkPublicEc;
  thumbprint: string;
}> {
  const { privateKey } = await generateKeyPair('ES256', { extractable: true });
  const privateJwk = (await exportJWK(privateKey)) as unknown as Record<string, unknown>;
  privateJwk['alg'] = 'ES256';
  const publicJwk = await toPublicJwk(privateJwk);
  return { privateJwk, publicJwk, thumbprint: await jwkThumbprint(publicJwk) };
}
