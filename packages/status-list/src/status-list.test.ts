import { beforeAll, describe, expect, it } from 'vitest';
import {
  createLocalSigner,
  generateEs256KeyPair,
  type CredentialSigner,
  type JwkPublicEc,
} from '@civiledger/credential';
import {
  allocateIndex,
  countSet,
  createBitstring,
  decodeList,
  DEFAULT_LIST_SIZE,
  encodeList,
  getBit,
  hashEncodedList,
  needsFreshList,
  setBit,
  StatusListError,
} from './bitstring.js';
import {
  buildSignedStatusList,
  checkStatus,
  createMemoryVersionFloor,
  type OnChainStatusList,
} from './published.js';

const ISS = 'https://civiledger.com.bd/issuers/uiu';
const URI = 'https://civiledger.com.bd/status/uiu/3';
const ORG_ID = '0x'.padEnd(66, 'a');
const NOW = 1_800_000_000;

let signer: CredentialSigner;
let publicJwk: JwkPublicEc;

beforeAll(async () => {
  const keys = await generateEs256KeyPair();
  signer = await createLocalSigner(keys.privateJwk, 'uiu-epoch-1');
  publicJwk = keys.publicJwk;
});

describe('bitstring', () => {
  it('defaults to 131,072 entries', () => {
    const list = createBitstring();
    expect(list.size).toBe(DEFAULT_LIST_SIZE);
    expect(list.bits.length).toBe(16_384);
    expect(countSet(list)).toBe(0);
  });

  it('sets and reads bits without mutating the original', () => {
    const empty = createBitstring(64);
    const withBit = setBit(empty, 17, true);
    expect(getBit(withBit, 17)).toBe(true);
    expect(getBit(empty, 17)).toBe(false);
    expect(getBit(withBit, 16)).toBe(false);
    expect(getBit(withBit, 18)).toBe(false);
  });

  it('uses most-significant-bit-first ordering, per the W3C spec', () => {
    const list = setBit(createBitstring(8), 0, true);
    expect(list.bits[0]).toBe(0x80);
    expect(setBit(createBitstring(8), 7, true).bits[0]).toBe(0x01);
  });

  it('clears a bit again', () => {
    const list = setBit(setBit(createBitstring(64), 5, true), 5, false);
    expect(getBit(list, 5)).toBe(false);
    expect(countSet(list)).toBe(0);
  });

  it('rejects an out-of-range index', () => {
    const list = createBitstring(64);
    expect(() => getBit(list, 64)).toThrow(StatusListError);
    expect(() => getBit(list, -1)).toThrow(StatusListError);
    expect(() => getBit(list, 1.5)).toThrow(StatusListError);
  });

  it('round-trips through gzip + base64url', () => {
    let list = createBitstring();
    for (const index of [0, 41_297, 99_999, DEFAULT_LIST_SIZE - 1]) {
      list = setBit(list, index, true);
    }
    const decoded = decodeList(encodeList(list), DEFAULT_LIST_SIZE);
    expect(countSet(decoded)).toBe(4);
    expect(getBit(decoded, 41_297)).toBe(true);
    expect(getBit(decoded, 41_296)).toBe(false);
  });

  it('compresses a sparse list to a couple of kilobytes', () => {
    const list = setBit(createBitstring(), 41_297, true);
    expect(encodeList(list).length).toBeLessThan(3_000);
  });

  it('refuses to decompress a list that is not a status list', () => {
    expect(() => decodeList('bm90IGd6aXA')).toThrow(/could not be decompressed/);
  });

  it('refuses a list whose size does not match what was expected', () => {
    const small = encodeList(createBitstring(64));
    expect(() => decodeList(small, DEFAULT_LIST_SIZE)).toThrow(/expected 131072/);
  });

  it('hashes the encoded bytes a verifier actually downloads', () => {
    const encoded = encodeList(setBit(createBitstring(), 7, true));
    expect(hashEncodedList(encoded)).toMatch(/^0x[0-9a-f]{64}$/);
    expect(hashEncodedList(encoded)).toBe(hashEncodedList(encoded));
    expect(hashEncodedList(encoded)).not.toBe(hashEncodedList(encodeList(createBitstring())));
  });
});

describe('index allocation', () => {
  it('does not allocate sequentially', () => {
    const taken = new Set<number>();
    const allocated: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      const index = allocateIndex((n) => taken.has(n));
      taken.add(index);
      allocated.push(index);
    }
    const sequential = allocated.every((n, i) => i === 0 || n === (allocated[i - 1] ?? -1) + 1);
    expect(sequential).toBe(false);
    expect(new Set(allocated).size).toBe(40);
  });

  it('never returns an index already taken', () => {
    const taken = new Set<number>([5]);
    for (let i = 0; i < 50; i += 1) {
      expect(allocateIndex((n) => taken.has(n), 8)).not.toBe(5);
    }
  });

  it('gives up rather than spinning when the list is full', () => {
    expect(() => allocateIndex(() => true, 64)).toThrow(/too full/);
  });

  it('asks for a fresh list at 80% occupancy', () => {
    expect(needsFreshList(104_857, DEFAULT_LIST_SIZE)).toBe(false);
    expect(needsFreshList(104_858, DEFAULT_LIST_SIZE)).toBe(true);
  });
});

describe('published status list', () => {
  const REVOKED_INDEX = 41_297;

  async function publish(version: number, revoked: number[] = [REVOKED_INDEX]) {
    let list = createBitstring();
    for (const index of revoked) list = setBit(list, index, true);
    return buildSignedStatusList({
      iss: ISS,
      uri: URI,
      orgId: ORG_ID,
      listId: 3,
      version,
      statusPurpose: 'revocation',
      list,
      issuedAt: NOW,
      signer,
    });
  }

  function onChainFor(published: Awaited<ReturnType<typeof publish>>): OnChainStatusList {
    return {
      listHash: published.payload.listHash,
      uri: URI,
      version: published.payload.version,
      updatedAt: NOW,
    };
  }

  it('reports a revoked credential', async () => {
    const published = await publish(212);
    const result = await checkStatus({
      jwt: published.jwt,
      index: REVOKED_INDEX,
      issuerJwk: publicJwk,
      onChain: onChainFor(published),
      now: NOW + 60,
      expectedUri: URI,
    });
    expect(result.set).toBe(true);
    expect(result.version).toBe(212);
    expect(result.listHashMatchesChain).toBe(true);
    expect(result.fresh).toBe(true);
  });

  it('reports a valid credential', async () => {
    const published = await publish(212);
    const result = await checkStatus({
      jwt: published.jwt,
      index: 99,
      issuerJwk: publicJwk,
      onChain: onChainFor(published),
      now: NOW,
    });
    expect(result.set).toBe(false);
  });

  it('rejects a list signed by the wrong key', async () => {
    const published = await publish(212);
    const stranger = (await generateEs256KeyPair()).publicJwk;
    await expect(
      checkStatus({ jwt: published.jwt, index: 1, issuerJwk: stranger, now: NOW }),
    ).rejects.toThrow(/signature does not verify/);
  });

  it('rejects a list whose hash does not match the chain', async () => {
    const published = await publish(212);
    await expect(
      checkStatus({
        jwt: published.jwt,
        index: 1,
        issuerJwk: publicJwk,
        onChain: { ...onChainFor(published), listHash: `0x${'f'.repeat(64)}` },
        now: NOW,
      }),
    ).rejects.toThrow(/not the one recorded on chain/);
  });

  it('rejects a list older than its on-chain anchor', async () => {
    const published = await publish(212);
    await expect(
      checkStatus({
        jwt: published.jwt,
        index: 1,
        issuerJwk: publicJwk,
        onChain: { ...onChainFor(published), version: 213 },
        now: NOW,
      }),
    ).rejects.toThrow(/chain records 213/);
  });

  it('flags — but does not reject — a list newer than its anchor', async () => {
    // A revocation published to the CDN whose anchoring transaction has not
    // confirmed yet. The revoked bit must still be honoured.
    const published = await publish(213);
    const result = await checkStatus({
      jwt: published.jwt,
      index: REVOKED_INDEX,
      issuerJwk: publicJwk,
      onChain: { ...onChainFor(published), version: 212 },
      now: NOW,
    });
    expect(result.set).toBe(true);
    expect(result.pendingAnchor).toBe(true);
    expect(result.listHashMatchesChain).toBe(false);
  });

  it('rejects a rolled-back list that would suppress a revocation', async () => {
    const floor = createMemoryVersionFloor();

    const current = await publish(212);
    const seen = await checkStatus({
      jwt: current.jwt,
      index: REVOKED_INDEX,
      issuerJwk: publicJwk,
      onChain: onChainFor(current),
      now: NOW,
      versionFloor: floor,
    });
    expect(seen.set).toBe(true);

    // An operator with CDN access replays the pre-revocation list. Its own
    // signature and hash are perfectly valid — only the version gives it away.
    const stale = await publish(211, []);
    await expect(
      checkStatus({
        jwt: stale.jwt,
        index: REVOKED_INDEX,
        issuerJwk: publicJwk,
        onChain: onChainFor(stale),
        now: NOW,
        versionFloor: floor,
      }),
    ).rejects.toThrow(/rolled back from version 212 to 211/);
  });

  it('accepts a newer version and raises the floor', async () => {
    const floor = createMemoryVersionFloor();
    const first = await publish(212);
    await checkStatus({
      jwt: first.jwt,
      index: 1,
      issuerJwk: publicJwk,
      now: NOW,
      versionFloor: floor,
    });
    const next = await publish(213);
    const result = await checkStatus({
      jwt: next.jwt,
      index: 1,
      issuerJwk: publicJwk,
      now: NOW,
      versionFloor: floor,
    });
    expect(result.version).toBe(213);
  });

  it('rejects a list served from a URL the credential does not point at', async () => {
    const published = await publish(212);
    await expect(
      checkStatus({
        jwt: published.jwt,
        index: 1,
        issuerJwk: publicJwk,
        now: NOW,
        expectedUri: 'https://civiledger.com.bd/status/uiu/4',
      }),
    ).rejects.toThrow(/different URL/);
  });

  it('flags a stale list rather than silently trusting it', async () => {
    const published = await publish(212);
    const result = await checkStatus({
      jwt: published.jwt,
      index: 1,
      issuerJwk: publicJwk,
      now: NOW + 7200,
    });
    expect(result.fresh).toBe(false);
    expect(result.ageSeconds).toBe(7200);
  });

  it('rejects a tampered encodedList', async () => {
    const published = await publish(212);
    const [header, payload, signature] = published.jwt.split('.');
    const decoded = JSON.parse(Buffer.from(payload!, 'base64url').toString());
    decoded.encodedList = encodeList(createBitstring());
    const forged = `${header}.${Buffer.from(JSON.stringify(decoded)).toString('base64url')}.${signature}`;
    await expect(
      checkStatus({ jwt: forged, index: 1, issuerJwk: publicJwk, now: NOW }),
    ).rejects.toThrow(/signature does not verify/);
  });

  it('refuses a non-positive version at publish time', async () => {
    await expect(publish(0)).rejects.toThrow(/positive integer/);
  });
});
