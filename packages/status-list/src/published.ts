/**
 * Publishing and checking a signed status list. PLAN.html §9.
 *
 * The list is served from a CDN, so nothing about it can be trusted on its own.
 * Three independent things must agree before a status bit is believed:
 *   1. the issuer's signature over the list,
 *   2. the list hash recorded on chain, and
 *   3. a version at or above the highest this verifier has already seen.
 *
 * (3) is the rollback defence. Without it, whoever controls the CDN can serve a
 * stale list to suppress a revocation, and every check still passes.
 */

import { compactVerify, importJWK } from 'jose';
import type { CredentialSigner, JwkPublicEc } from '@civiledger/credential';
import { encodeBase64Url, decodeBase64UrlToString } from '@civiledger/credential';
import {
  decodeList,
  encodeList,
  getBit,
  hashEncodedList,
  StatusListError,
  type Bitstring,
  type StatusPurpose,
} from './bitstring.js';

export const STATUS_LIST_TYP = 'statuslist+jwt';

export interface StatusListPayload {
  /** Issuer identifier — the same `iss` the credentials carry. */
  iss: string;
  /** The stable URL this list is published at, echoed so it cannot be moved. */
  sub: string;
  iat: number;
  /** Freshness window. A verifier past this must refetch before trusting a bit. */
  exp: number;
  /** Cache lifetime hint in seconds. */
  ttl: number;
  statusPurpose: StatusPurpose;
  /** keccak/sha of the organisation identifier as the chain holds it. */
  orgId: string;
  listId: number;
  /** Monotonic. Must equal the version recorded on chain. */
  version: number;
  size: number;
  /** base64url(gzip(bitstring)). */
  encodedList: string;
  /** 0x-prefixed sha-256 over `encodedList`; the value anchored on chain. */
  listHash: string;
}

export interface BuildStatusListOptions {
  iss: string;
  uri: string;
  orgId: string;
  listId: number;
  version: number;
  statusPurpose: StatusPurpose;
  list: Bitstring;
  issuedAt: number;
  /** Seconds. PLAN §9 suggests one hour. */
  ttl?: number;
  signer: CredentialSigner;
}

export interface SignedStatusList {
  jwt: string;
  payload: StatusListPayload;
}

export async function buildSignedStatusList(
  options: BuildStatusListOptions,
): Promise<SignedStatusList> {
  const {
    iss,
    uri,
    orgId,
    listId,
    version,
    statusPurpose,
    list,
    issuedAt,
    ttl = 3600,
    signer,
  } = options;

  if (!Number.isInteger(version) || version < 1) {
    throw new StatusListError('BAD_VERSION', 'version must be a positive integer');
  }

  const encodedList = encodeList(list);
  const payload: StatusListPayload = {
    iss,
    sub: uri,
    iat: issuedAt,
    exp: issuedAt + ttl,
    ttl,
    statusPurpose,
    orgId,
    listId,
    version,
    size: list.size,
    encodedList,
    listHash: hashEncodedList(encodedList),
  };

  const header: Record<string, unknown> = { alg: signer.alg, typ: STATUS_LIST_TYP };
  if (signer.kid !== undefined) header['kid'] = signer.kid;

  const signingInput = `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(
    JSON.stringify(payload),
  )}`;
  const signature = await signer.sign(new TextEncoder().encode(signingInput));

  return { jwt: `${signingInput}.${encodeBase64Url(signature)}`, payload };
}

/** What the chain says about a list, as read from StatusRegistry. */
export interface OnChainStatusList {
  listHash: string;
  uri: string;
  version: number;
  updatedAt: number;
}

/** Highest version this verifier has previously accepted for a given list. */
export interface VersionFloor {
  get(key: string): number | undefined;
  set(key: string, version: number): void;
}

/** An in-memory floor. Persist it (Redis, IndexedDB) in anything long-lived. */
export function createMemoryVersionFloor(): VersionFloor {
  const seen = new Map<string, number>();
  return {
    get: (key) => seen.get(key),
    set: (key, version) => {
      const current = seen.get(key);
      if (current === undefined || version > current) seen.set(key, version);
    },
  };
}

export function versionFloorKey(orgId: string, listId: number, purpose: StatusPurpose): string {
  return `${orgId}:${listId}:${purpose}`;
}

export interface CheckStatusOptions {
  /** The signed status list JWT, exactly as fetched. */
  jwt: string;
  /** Index the credential carries. */
  index: number;
  /** Issuer public key, resolved from the registry at the list's `iat`. */
  issuerJwk: JwkPublicEc;
  /** What the chain currently records for this list. Omit only when offline. */
  onChain?: OnChainStatusList;
  /** Seconds since epoch. */
  now: number;
  clockSkewSeconds?: number;
  versionFloor?: VersionFloor;
  /** Expected `sub` — the URI the credential's status claim points at. */
  expectedUri?: string;
}

export interface StatusCheckResult {
  /** True when the bit is set: revoked, or suspended on a suspension list. */
  set: boolean;
  purpose: StatusPurpose;
  version: number;
  /** Whether the served list's hash matched what the chain records. */
  listHashMatchesChain: boolean;
  /**
   * True when the list is strictly newer than its on-chain anchor — a
   * revocation whose anchoring transaction has not confirmed yet.
   */
  pendingAnchor: boolean;
  /** False when the list is past its freshness window. */
  fresh: boolean;
  /** Seconds since the list was issued. */
  ageSeconds: number;
  payload: StatusListPayload;
}

export async function checkStatus(options: CheckStatusOptions): Promise<StatusCheckResult> {
  const {
    jwt,
    index,
    issuerJwk,
    onChain,
    now,
    clockSkewSeconds = 60,
    versionFloor,
    expectedUri,
  } = options;

  const { header, payload } = decodeJwt(jwt);
  if (header['typ'] !== STATUS_LIST_TYP) {
    throw new StatusListError('BAD_TYP', 'not a status list JWT');
  }
  if (header['alg'] !== 'ES256') {
    throw new StatusListError('UNSUPPORTED_ALG', 'only ES256 is accepted');
  }

  const key = await importJWK(issuerJwk as never, 'ES256');
  try {
    await compactVerify(jwt, key, { algorithms: ['ES256'] });
  } catch {
    throw new StatusListError('BAD_SIGNATURE', 'status list signature does not verify');
  }

  if (expectedUri !== undefined && payload.sub !== expectedUri) {
    throw new StatusListError(
      'URI_MISMATCH',
      'status list was served from a different URL than the credential points at',
    );
  }

  // The hash must cover the bytes actually served, not a recomputation.
  if (hashEncodedList(payload.encodedList) !== payload.listHash) {
    throw new StatusListError('HASH_MISMATCH', 'listHash does not cover the served list');
  }

  let listHashMatchesChain = false;
  let pendingAnchor = false;
  if (onChain) {
    if (payload.version < onChain.version) {
      // The chain has moved on. Being served an older list is the CDN rollback
      // attack, whatever its signature says.
      throw new StatusListError(
        'CHAIN_VERSION_MISMATCH',
        `served list is version ${payload.version} but the chain records ${onChain.version}`,
      );
    }
    if (payload.version > onChain.version) {
      // A revocation published to the CDN whose anchoring transaction has not
      // confirmed yet. The bit is trustworthy — it is signed and strictly newer
      // than the anchor — but it is not yet externally provable, so the caller
      // is told rather than being given a clean pass.
      pendingAnchor = true;
    } else if (onChain.listHash.toLowerCase() !== payload.listHash.toLowerCase()) {
      throw new StatusListError(
        'CHAIN_HASH_MISMATCH',
        'the served status list is not the one recorded on chain',
      );
    } else {
      listHashMatchesChain = true;
    }
  }

  // Rollback defence. PLAN §9.
  if (versionFloor) {
    const key2 = versionFloorKey(payload.orgId, payload.listId, payload.statusPurpose);
    const floor = versionFloor.get(key2);
    if (floor !== undefined && payload.version < floor) {
      throw new StatusListError(
        'VERSION_ROLLBACK',
        `status list rolled back from version ${floor} to ${payload.version}`,
      );
    }
    versionFloor.set(key2, payload.version);
  }

  const ageSeconds = now - payload.iat;
  const fresh = now - clockSkewSeconds <= payload.exp;

  const list = decodeList(payload.encodedList, payload.size);
  return {
    set: getBit(list, index),
    purpose: payload.statusPurpose,
    version: payload.version,
    listHashMatchesChain,
    pendingAnchor,
    fresh,
    ageSeconds,
    payload,
  };
}

function decodeJwt(jwt: string): { header: Record<string, unknown>; payload: StatusListPayload } {
  const [rawHeader, rawPayload] = jwt.split('.');
  if (!rawHeader || !rawPayload) {
    throw new StatusListError('MALFORMED_JWT', 'status list JWT is malformed');
  }
  try {
    return {
      header: JSON.parse(decodeBase64UrlToString(rawHeader)) as Record<string, unknown>,
      payload: JSON.parse(decodeBase64UrlToString(rawPayload)) as StatusListPayload,
    };
  } catch {
    throw new StatusListError('MALFORMED_JWT', 'status list JWT is not valid JSON');
  }
}
