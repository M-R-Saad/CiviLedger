/**
 * W3C Bitstring Status List — the bitstring itself. PLAN.html §9.
 *
 * One bit per credential. 0 = valid, 1 = set (revoked, or suspended on a
 * suspension-purpose list). A single on-chain transaction covers the whole
 * list, so revocation costs nothing per credential and a verifier can cache
 * the list and check status entirely offline.
 */

import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash, randomInt } from 'node:crypto';

/** PLAN §9: 131,072 entries — 16 KB uncompressed, ~2 KB gzipped when sparse. */
export const DEFAULT_LIST_SIZE = 131_072;

/**
 * Refuse to decompress beyond this. A status list is fetched from a CDN by
 * verifiers we do not control; without a cap, a hostile or corrupted list is a
 * zip bomb against every verifier at once.
 */
const MAX_DECOMPRESSED_BYTES = 1024 * 1024;

export type StatusPurpose = 'revocation' | 'suspension';

export class StatusListError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'StatusListError';
    this.code = code;
  }
}

export interface Bitstring {
  readonly bits: Uint8Array;
  readonly size: number;
}

export function createBitstring(size: number = DEFAULT_LIST_SIZE): Bitstring {
  assertValidSize(size);
  return { bits: new Uint8Array(size / 8), size };
}

export function fromBytes(bits: Uint8Array, size: number = bits.length * 8): Bitstring {
  assertValidSize(size);
  if (bits.length !== size / 8) {
    throw new StatusListError('SIZE_MISMATCH', 'bitstring length does not match the declared size');
  }
  return { bits, size };
}

function assertValidSize(size: number): void {
  if (!Number.isInteger(size) || size <= 0 || size % 8 !== 0) {
    throw new StatusListError('BAD_SIZE', 'list size must be a positive multiple of 8');
  }
  if (size > MAX_DECOMPRESSED_BYTES * 8) {
    throw new StatusListError('BAD_SIZE', 'list size exceeds the maximum');
  }
}

function locate(list: Bitstring, index: number): { byte: number; mask: number } {
  if (!Number.isInteger(index) || index < 0 || index >= list.size) {
    throw new StatusListError('INDEX_OUT_OF_RANGE', `index ${index} is outside the list`);
  }
  // Most-significant bit first, per the W3C spec.
  return { byte: index >>> 3, mask: 0x80 >>> (index & 7) };
}

export function getBit(list: Bitstring, index: number): boolean {
  const { byte, mask } = locate(list, index);
  return ((list.bits[byte] ?? 0) & mask) !== 0;
}

/** Returns a new bitstring; the input is never mutated. */
export function setBit(list: Bitstring, index: number, value: boolean): Bitstring {
  const { byte, mask } = locate(list, index);
  const next = new Uint8Array(list.bits);
  const current = next[byte] ?? 0;
  next[byte] = value ? current | mask : current & ~mask & 0xff;
  return { bits: next, size: list.size };
}

export function countSet(list: Bitstring): number {
  let total = 0;
  for (const byte of list.bits) {
    let b = byte;
    while (b) {
      b &= b - 1;
      total += 1;
    }
  }
  return total;
}

/** `encodedList` as the W3C spec defines it: base64url(gzip(bitstring)). */
export function encodeList(list: Bitstring): string {
  return gzipSync(Buffer.from(list.bits), { level: 9 }).toString('base64url');
}

export function decodeList(encodedList: string, expectedSize?: number): Bitstring {
  let raw: Buffer;
  try {
    raw = gunzipSync(Buffer.from(encodedList, 'base64url'), {
      maxOutputLength: MAX_DECOMPRESSED_BYTES,
    });
  } catch (error) {
    throw new StatusListError(
      'MALFORMED_LIST',
      `status list could not be decompressed: ${error instanceof Error ? error.message : 'unknown'}`,
    );
  }
  const size = raw.length * 8;
  if (expectedSize !== undefined && size !== expectedSize) {
    throw new StatusListError(
      'SIZE_MISMATCH',
      `status list is ${size} entries, expected ${expectedSize}`,
    );
  }
  return fromBytes(new Uint8Array(raw), size);
}

/**
 * The digest anchored on chain. Taken over the *encoded* list — the exact bytes
 * a verifier fetches — so a verifier can compare what it downloaded against the
 * chain without needing to reproduce our compression settings.
 */
export function hashEncodedList(encodedList: string): string {
  return `0x${createHash('sha256').update(encodedList, 'ascii').digest('hex')}`;
}

/** PLAN §9: a fresh list is started once the current one reaches 80% occupancy. */
export const OCCUPANCY_THRESHOLD = 0.8;

export function needsFreshList(allocatedCount: number, size: number = DEFAULT_LIST_SIZE): boolean {
  return allocatedCount >= size * OCCUPANCY_THRESHOLD;
}

/**
 * Allocate an index at random.
 *
 * Sequential allocation would leak cohort and issuance order to anyone holding
 * the list — which is everyone, because the list is public (PLAN §9, §17).
 * `isTaken` is injected so the caller can check against the database inside its
 * own transaction; this function does no I/O.
 */
export function allocateIndex(
  isTaken: (index: number) => boolean,
  size: number = DEFAULT_LIST_SIZE,
  maxAttempts = 64,
): number {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = randomInt(0, size);
    if (!isTaken(candidate)) return candidate;
  }
  throw new StatusListError(
    'ALLOCATION_FAILED',
    'could not find a free index — the list is too full; start a new one',
  );
}
