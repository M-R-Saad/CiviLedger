/**
 * Envelope encryption for personal data at rest. PLAN.html §14, §18.
 *
 * Every `*_enc` column is a self-describing blob:
 *
 *   [ version:1 ][ keyId:1 ][ dekIv:12 ][ wrappedDek:32 ][ dekTag:16 ]
 *   [ dataIv:12 ][ ciphertext:N ][ dataTag:16 ]
 *
 * A fresh 256-bit data key is generated per row and wrapped with the key
 * encryption key. Two consequences the design depends on:
 *
 *   - Rotating the KEK rewraps data keys; it does not rewrite every row.
 *   - Erasure is implemented as key destruction (§18). Dropping a row destroys
 *     its data key, and with it the only way to read that row's ciphertext or
 *     to reproduce the salt that links it to an on-chain anchor.
 *
 * The KEK itself comes from the environment in development and from a KMS in
 * production; this module never persists it.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const VERSION = 1;
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const DEK_BYTES = 32;

const HEADER = 1 + 1 + IV_BYTES + DEK_BYTES + TAG_BYTES;

export class CryptoError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'CryptoError';
    this.code = code;
  }
}

export interface KeyRing {
  /** The key new writes are encrypted under. */
  readonly activeKeyId: number;
  /** Every key still needed to read existing rows, including the active one. */
  key(keyId: number): Buffer;
  /** Separate key for blind indexes. Never the same bytes as a KEK. */
  readonly indexKey: Buffer;
}

/**
 * Build a key ring from environment material.
 * @param keys `keyId:base64` entries, newest last.
 */
export function createKeyRing(keys: readonly string[], indexKeyB64: string): KeyRing {
  if (keys.length === 0) {
    throw new CryptoError('NO_KEYS', 'at least one data encryption key is required');
  }

  const table = new Map<number, Buffer>();
  let activeKeyId = -1;

  for (const entry of keys) {
    const [rawId, rawKey] = entry.split(':');
    const keyId = Number(rawId);
    if (!Number.isInteger(keyId) || keyId < 0 || keyId > 255) {
      throw new CryptoError('BAD_KEY_ID', `key id "${rawId}" must be an integer 0-255`);
    }
    const key = Buffer.from(rawKey ?? '', 'base64');
    if (key.length !== 32) {
      throw new CryptoError('BAD_KEY', `key ${keyId} must be 32 bytes of base64`);
    }
    table.set(keyId, key);
    activeKeyId = keyId;
  }

  const indexKey = Buffer.from(indexKeyB64, 'base64');
  if (indexKey.length !== 32) {
    throw new CryptoError('BAD_INDEX_KEY', 'blind index key must be 32 bytes of base64');
  }
  for (const key of table.values()) {
    if (key.equals(indexKey)) {
      throw new CryptoError(
        'KEY_REUSE',
        'the blind index key must not be reused as a data encryption key',
      );
    }
  }

  return {
    activeKeyId,
    key(keyId: number): Buffer {
      const key = table.get(keyId);
      if (!key) {
        throw new CryptoError('UNKNOWN_KEY', `no key ${keyId} in the ring — cannot decrypt`);
      }
      return key;
    },
    indexKey,
  };
}

/** Generate key material for a fresh environment. Used by `pnpm keygen`. */
export function generateKeyMaterial(): { dataKey: string; indexKey: string } {
  return {
    dataKey: randomBytes(32).toString('base64'),
    indexKey: randomBytes(32).toString('base64'),
  };
}

/**
 * Copy into a freshly allocated, non-shared buffer.
 *
 * Prisma's `Bytes` columns are typed `Uint8Array<ArrayBuffer>`, while Node's
 * `Buffer` is `Uint8Array<ArrayBufferLike>` — which also admits
 * `SharedArrayBuffer`, and so does not satisfy it. Allocating explicitly is the
 * narrowest fix, and keeps casts out of every persistence call site.
 */
export function toBytes(input: string | Buffer | Uint8Array): Uint8Array<ArrayBuffer> {
  const source = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  const out = new Uint8Array(new ArrayBuffer(source.length));
  out.set(source);
  return out;
}

export function encrypt(ring: KeyRing, plaintext: string | Buffer): Uint8Array<ArrayBuffer> {
  const data = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
  const kek = ring.key(ring.activeKeyId);

  const dek = randomBytes(DEK_BYTES);
  const dekIv = randomBytes(IV_BYTES);
  const dekCipher = createCipheriv(ALGO, kek, dekIv);
  const wrappedDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);
  const dekTag = dekCipher.getAuthTag();

  const dataIv = randomBytes(IV_BYTES);
  const dataCipher = createCipheriv(ALGO, dek, dataIv);
  const ciphertext = Buffer.concat([dataCipher.update(data), dataCipher.final()]);
  const dataTag = dataCipher.getAuthTag();

  dek.fill(0);

  return toBytes(
    Buffer.concat([
      Buffer.from([VERSION, ring.activeKeyId]),
      dekIv,
      wrappedDek,
      dekTag,
      dataIv,
      ciphertext,
      dataTag,
    ]),
  );
}

export function decrypt(ring: KeyRing, blob: Buffer | Uint8Array): Buffer {
  const buffer = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  if (buffer.length < HEADER + IV_BYTES + TAG_BYTES) {
    throw new CryptoError('MALFORMED', 'ciphertext is too short to be valid');
  }
  if (buffer[0] !== VERSION) {
    throw new CryptoError('BAD_VERSION', `unsupported ciphertext version ${String(buffer[0])}`);
  }

  const keyId = buffer[1]!;
  const kek = ring.key(keyId);

  let offset = 2;
  const dekIv = buffer.subarray(offset, (offset += IV_BYTES));
  const wrappedDek = buffer.subarray(offset, (offset += DEK_BYTES));
  const dekTag = buffer.subarray(offset, (offset += TAG_BYTES));
  const dataIv = buffer.subarray(offset, (offset += IV_BYTES));
  const dataTag = buffer.subarray(buffer.length - TAG_BYTES);
  const ciphertext = buffer.subarray(offset, buffer.length - TAG_BYTES);

  const dekDecipher = createDecipheriv(ALGO, kek, dekIv);
  dekDecipher.setAuthTag(dekTag);
  let dek: Buffer;
  try {
    dek = Buffer.concat([dekDecipher.update(wrappedDek), dekDecipher.final()]);
  } catch {
    throw new CryptoError('AUTH_FAILED', 'data key does not authenticate — wrong key or tampering');
  }

  const dataDecipher = createDecipheriv(ALGO, dek, dataIv);
  dataDecipher.setAuthTag(dataTag);
  try {
    return Buffer.concat([dataDecipher.update(ciphertext), dataDecipher.final()]);
  } catch {
    throw new CryptoError('AUTH_FAILED', 'ciphertext does not authenticate — it has been altered');
  } finally {
    dek.fill(0);
  }
}

export function encryptJson(ring: KeyRing, value: unknown): Uint8Array<ArrayBuffer> {
  return encrypt(ring, JSON.stringify(value));
}

export function decryptJson<T>(ring: KeyRing, blob: Buffer | Uint8Array): T {
  return JSON.parse(decrypt(ring, blob).toString('utf8')) as T;
}

export function decryptString(ring: KeyRing, blob: Buffer | Uint8Array): string {
  return decrypt(ring, blob).toString('utf8');
}

/**
 * A deterministic index over an encrypted value, so a login can find a row
 * without decrypting the table.
 *
 * HMAC, not a bare hash: an email address is a small-domain value and a plain
 * hash of one is a lookup table away from being the value (PLAN §6.2).
 */
export function blindIndex(ring: KeyRing, value: string): string {
  return createHmac('sha256', ring.indexKey)
    .update(value.trim().toLowerCase(), 'utf8')
    .digest('base64url');
}

/** Constant-time comparison for tokens and digests. */
export function safeEquals(a: string, b: string): boolean {
  const left = toBytes(a);
  const right = toBytes(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
