/**
 * End-to-end verification tests.
 *
 * These exercise the whole product path — issue, present, verify — against
 * in-memory ports, and they are written as the threat model (PLAN §17) rather
 * than as a list of functions: each test is an attack that must fail, or a
 * legitimate case that must survive.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createLocalSigner,
  generateEs256KeyPair,
  issueCredential,
  presentCredential,
  type AlwaysVisibleClaims,
  type CredentialSigner,
  type JwkPublicEc,
} from '@civiledger/credential';
import {
  buildSignedStatusList,
  createBitstring,
  createMemoryVersionFloor,
  hashEncodedList,
  setBit,
  type Bitstring,
} from '@civiledger/status-list';
import { verifyPresentation } from './verify.js';
import type {
  AnchorSource,
  IssuerDirectory,
  IssuerResolution,
  OnChainStatusListRecord,
  StatusListSource,
} from './types.js';

const ISS = 'https://civiledger.com.bd/issuers/uiu';
const ORG_ID = `0x${'ab'.repeat(32)}`;
const STATUS_URI = 'https://civiledger.com.bd/status/uiu/3';
const STATUS_INDEX = 41_297;
const NOW = 1_800_000_000;
const SIGNED_AT = NOW - 30 * 86_400;

const ALWAYS_VISIBLE: AlwaysVisibleClaims = {
  issuer_name: 'United International University',
  accreditation: 'UGC_RECOGNIZED',
  assurance_level: 'AL2',
  evidence: {
    method: 'REGISTRAR_SOURCE_CHECK',
    source_system: 'UIU SIS',
    checked_at: '2027-02-11',
    checked_by_role: 'EXAM_CONTROLLER',
  },
};

const CLAIMS = {
  given_name: 'Ahnaf',
  family_name: 'Rahman',
  date_of_birth: '2001-04-17',
  programme: 'BSc in Computer Science and Engineering',
  degree_level: 'BACHELOR',
  result_cgpa: 3.71,
  result_class: 'FIRST_CLASS',
  graduation_date: '2024-11-30',
  registration_no: 'UIU-CSE-2019-0412',
};

let issuerSigner: CredentialSigner;
let issuerJwk: JwkPublicEc;
let holderSigner: CredentialSigner;
let holderJwk: JwkPublicEc;

beforeAll(async () => {
  const issuer = await generateEs256KeyPair();
  issuerSigner = await createLocalSigner(issuer.privateJwk, 'uiu-epoch-1');
  issuerJwk = issuer.publicJwk;
  const holder = await generateEs256KeyPair();
  holderSigner = await createLocalSigner(holder.privateJwk);
  holderJwk = holder.publicJwk;
});

// --- in-memory ports --------------------------------------------------------

function directory(overrides: Partial<IssuerResolution> = {}, basis: 'live' | 'cached' = 'live') {
  const dir: IssuerDirectory = {
    basis,
    ...(basis === 'cached' ? { snapshotAt: NOW - 3600 } : {}),
    resolve: async (): Promise<IssuerResolution> => ({
      orgId: ORG_ID,
      name: 'United International University',
      didWeb: 'did:web:civiledger.com.bd:issuers:uiu',
      accreditation: 'UGC_RECOGNIZED',
      status: 'ACTIVE',
      jwk: issuerJwk,
      keyThumbprint: issuerSigner.thumbprint,
      validAtSigningTime: true,
      ...overrides,
    }),
  };
  return dir;
}

class FakeStatusLists implements StatusListSource {
  public jwt: string | undefined;
  public chainRecord: OnChainStatusListRecord | undefined;
  public fetchThrows = false;

  async fetch(): Promise<string | undefined> {
    if (this.fetchThrows) throw new Error('CDN down');
    return this.jwt;
  }
  async onChain(): Promise<OnChainStatusListRecord | undefined> {
    return this.chainRecord;
  }
}

const passingAnchors: AnchorSource = { verify: async () => true };
const failingAnchors: AnchorSource = { verify: async () => false };

async function publishList(revoked: number[], version: number, list?: Bitstring) {
  let bits = list ?? createBitstring();
  for (const index of revoked) bits = setBit(bits, index, true);
  const signed = await buildSignedStatusList({
    iss: ISS,
    uri: STATUS_URI,
    orgId: ORG_ID,
    listId: 3,
    version,
    statusPurpose: 'revocation',
    list: bits,
    issuedAt: NOW - 60,
    signer: issuerSigner,
  });
  return {
    jwt: signed.jwt,
    chain: {
      listHash: signed.payload.listHash,
      uri: STATUS_URI,
      version,
      updatedAt: NOW - 60,
    } satisfies OnChainStatusListRecord,
  };
}

async function issue(overrides: Record<string, unknown> = {}) {
  return issueCredential({
    iss: ISS,
    vct: 'bd.civiledger.academic.degree.v1',
    claims: CLAIMS,
    alwaysVisible: ALWAYS_VISIBLE,
    holderJwk,
    issuedAt: SIGNED_AT,
    expiresAt: null,
    status: { status_list: { idx: STATUS_INDEX, uri: STATUS_URI } },
    signer: issuerSigner,
    ...overrides,
  });
}

let statusLists: FakeStatusLists;

beforeEach(async () => {
  statusLists = new FakeStatusLists();
  const published = await publishList([], 212);
  statusLists.jwt = published.jwt;
  statusLists.chainRecord = published.chain;
});

// --- the happy path ---------------------------------------------------------

describe('a genuine credential', () => {
  it('verifies, and reports how rigorously it was checked', async () => {
    const credential = await issue();
    const report = await verifyPresentation({
      sdJwt: credential.sdJwt,
      issuers: directory(),
      statusLists,
      now: NOW,
    });

    expect(report.result).toBe('valid');
    expect(report.basis).toBe('live');
    expect(report.claims['given_name']).toBe('Ahnaf');
    expect(report.credential.assuranceLevel).toBe('AL2');
    expect(report.credential.evidence.method).toBe('REGISTRAR_SOURCE_CHECK');
    expect(report.issuer.accreditation).toBe('UGC_RECOGNIZED');
    expect(report.status.revoked).toBe(false);
    expect(report.status.listHashMatchesChain).toBe(true);
    expect(report.failureCode).toBeUndefined();
  });

  it('honours a narrow claim scope', async () => {
    const credential = await issue();
    const presentation = await presentCredential({
      issuedSdJwt: credential.sdJwt,
      claimScope: ['given_name', 'family_name', 'degree_level'],
    });

    const report = await verifyPresentation({
      sdJwt: presentation,
      issuers: directory(),
      statusLists,
      now: NOW,
    });

    expect(report.result).toBe('valid');
    expect(Object.keys(report.claims).sort()).toEqual([
      'degree_level',
      'family_name',
      'given_name',
    ]);
    expect(report.withheldClaims).toContain('result_cgpa');
    expect(report.withheldClaims).toContain('date_of_birth');
  });

  it('verifies an anchor inclusion proof when one is presented', async () => {
    const credential = await issue();
    const report = await verifyPresentation({
      sdJwt: credential.sdJwt,
      anchor: { batchId: `0x${'11'.repeat(32)}`, leaf: `0x${'22'.repeat(32)}`, proof: [] },
      anchors: passingAnchors,
      issuers: directory(),
      statusLists,
      now: NOW,
    });
    expect(report.result).toBe('valid');
    expect(report.integrity.anchorProof).toBe('pass');
    expect(report.integrity.anchorBatchId).toBe(`0x${'11'.repeat(32)}`);
  });

  it('says clearly when no anchor proof was presented', async () => {
    const report = await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      issuers: directory(),
      statusLists,
      now: NOW,
    });
    expect(report.integrity.anchorProof).toBe('skipped');
    expect(report.checks.find((c) => c.id === 'anchor_inclusion')?.code).toBe(
      'ANCHOR_NOT_PRESENTED',
    );
  });
});

// --- the threat model -------------------------------------------------------

describe('revocation', () => {
  it('reports a revoked credential as revoked, not merely invalid', async () => {
    const published = await publishList([STATUS_INDEX], 213);
    statusLists.jwt = published.jwt;
    statusLists.chainRecord = published.chain;

    const report = await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      issuers: directory(),
      statusLists,
      now: NOW,
    });

    expect(report.result).toBe('revoked');
    expect(report.status.revoked).toBe(true);
    expect(report.failureCode).toBe('CREDENTIAL_REVOKED');
  });

  it('rejects a rolled-back status list that would suppress a revocation', async () => {
    const floor = createMemoryVersionFloor();

    const revoked = await publishList([STATUS_INDEX], 213);
    statusLists.jwt = revoked.jwt;
    statusLists.chainRecord = revoked.chain;
    const first = await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      issuers: directory(),
      statusLists,
      now: NOW,
      versionFloor: floor,
    });
    expect(first.result).toBe('revoked');

    // Whoever controls the CDN replays the pre-revocation list. Its signature
    // and hash are genuine — only the version betrays it.
    const stale = await publishList([], 212);
    statusLists.jwt = stale.jwt;
    statusLists.chainRecord = stale.chain;

    const second = await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      issuers: directory(),
      statusLists,
      now: NOW,
      versionFloor: floor,
    });
    expect(second.result).not.toBe('valid');
    expect(second.failureCode).toBe('VERSION_ROLLBACK');
  });

  it('rejects a status list whose hash does not match the chain', async () => {
    statusLists.chainRecord = {
      listHash: `0x${'ff'.repeat(32)}`,
      uri: STATUS_URI,
      version: 212,
      updatedAt: NOW,
    };
    const report = await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      issuers: directory(),
      statusLists,
      now: NOW,
    });
    expect(report.result).toBe('invalid');
    expect(report.failureCode).toBe('CHAIN_HASH_MISMATCH');
  });
});

describe('issuer keys', () => {
  it('rejects a credential signed after its issuer key was compromised', async () => {
    const report = await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      issuers: directory({ validAtSigningTime: false, revocationReason: 'KEY_COMPROMISE' }),
      statusLists,
      now: NOW,
    });
    expect(report.result).toBe('invalid');
    expect(report.failureCode).toBe('KEY_NOT_VALID_AT_SIGNING');
    expect(report.issuer.keyRevocationReason).toBe('KEY_COMPROMISE');
  });

  it('still verifies a credential signed before the compromise window', async () => {
    // The registry answers for the signing time, not for now — so a key that
    // is revoked today still vouches for what it signed last year.
    const report = await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      issuers: directory({ validAtSigningTime: true, revocationReason: 'KEY_COMPROMISE' }),
      statusLists,
      now: NOW,
    });
    expect(report.result).toBe('valid');
    expect(report.issuer.keyRevocationReason).toBe('KEY_COMPROMISE');
  });

  it('passes the signing timestamp to the registry, never the current time', async () => {
    let seen: number | undefined;
    await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      issuers: {
        basis: 'live',
        resolve: async (_iss, signedAt) => {
          seen = signedAt;
          return {
            orgId: ORG_ID,
            name: 'UIU',
            didWeb: 'did:web:x',
            accreditation: 'UGC_RECOGNIZED',
            status: 'ACTIVE',
            jwk: issuerJwk,
            keyThumbprint: issuerSigner.thumbprint,
            validAtSigningTime: true,
          };
        },
      },
      statusLists,
      now: NOW,
    });
    expect(seen).toBe(SIGNED_AT);
  });

  it('rejects an issuer that is not in the registry', async () => {
    const report = await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      issuers: { basis: 'live', resolve: async () => undefined },
      statusLists,
      now: NOW,
    });
    expect(report.result).toBe('unknown_issuer');
    expect(report.failureCode).toBe('ISSUER_NOT_IN_REGISTRY');
    expect(report.claims).toEqual({});
  });

  it('flags a suspended issuer without discarding what it already signed', async () => {
    const report = await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      issuers: directory({ status: 'SUSPENDED' }),
      statusLists,
      now: NOW,
    });
    expect(report.issuer.status).toBe('SUSPENDED');
    expect(report.checks.find((c) => c.id === 'issuer_known')?.code).toBe('ISSUER_SUSPENDED');
    expect(report.result).toBe('valid');
  });
});

describe('forgery', () => {
  it('rejects a credential signed by a key the registry does not vouch for', async () => {
    const impostor = await generateEs256KeyPair();
    const forged = await issue({ signer: await createLocalSigner(impostor.privateJwk) });

    const report = await verifyPresentation({
      sdJwt: forged.sdJwt,
      issuers: directory(),
      statusLists,
      now: NOW,
    });
    expect(report.result).toBe('invalid');
    expect(report.failureCode).toBe('BAD_SIGNATURE');
    expect(report.claims).toEqual({});
  });

  it('rejects an altered claim', async () => {
    const credential = await issue();
    const [jwt] = credential.sdJwt.split('~');
    // Substitute a disclosure claiming a better grade.
    const forgedDisclosure = Buffer.from(
      JSON.stringify(['saltsaltsaltsalt', 'result_cgpa', 4.0]),
    ).toString('base64url');

    const report = await verifyPresentation({
      sdJwt: `${jwt}~${forgedDisclosure}~`,
      issuers: directory(),
      statusLists,
      now: NOW,
    });
    expect(report.result).toBe('invalid');
    expect(report.failureCode).toBe('UNMATCHED_DISCLOSURE');
  });

  it('rejects an upgraded assurance level', async () => {
    const credential = await issue();
    const [header, payload, signature] = credential.jwt.split('.');
    const decoded = JSON.parse(Buffer.from(payload!, 'base64url').toString());
    decoded.assurance_level = 'AL3+';
    const tampered = `${header}.${Buffer.from(JSON.stringify(decoded)).toString('base64url')}.${signature}~`;

    const report = await verifyPresentation({
      sdJwt: tampered,
      issuers: directory(),
      statusLists,
      now: NOW,
    });
    expect(report.result).toBe('invalid');
    expect(report.failureCode).toBe('BAD_SIGNATURE');
  });

  it('rejects a credential that is not an SD-JWT at all', async () => {
    const report = await verifyPresentation({
      sdJwt: 'definitely-not-a-credential',
      issuers: directory(),
      statusLists,
      now: NOW,
    });
    expect(report.result).toBe('invalid');
    expect(report.failureCode).toBe('MALFORMED_SD_JWT');
  });

  it('rejects a credential whose anchor proof does not check out', async () => {
    const report = await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      anchor: { batchId: `0x${'11'.repeat(32)}`, leaf: `0x${'22'.repeat(32)}`, proof: [] },
      anchors: failingAnchors,
      issuers: directory(),
      statusLists,
      now: NOW,
    });
    expect(report.result).toBe('invalid');
    expect(report.failureCode).toBe('ANCHOR_NOT_INCLUDED');
  });
});

describe('holder binding', () => {
  it('reports a verified binding when the holder proves possession', async () => {
    const credential = await issue();
    const presentation = await presentCredential({
      issuedSdJwt: credential.sdJwt,
      claimScope: ['given_name'],
      keyBinding: {
        audience: 'https://employer.example',
        nonce: 'nonce-1',
        issuedAt: NOW,
        signer: holderSigner,
      },
    });

    const report = await verifyPresentation({
      sdJwt: presentation,
      issuers: directory(),
      statusLists,
      now: NOW,
      expectedAudience: 'https://employer.example',
      expectedNonce: 'nonce-1',
      requireKeyBinding: true,
    });

    expect(report.result).toBe('valid');
    expect(report.holderBinding).toBe('verified');
  });

  it('fails closed when a regulated verifier requires binding and gets none', async () => {
    const report = await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      issuers: directory(),
      statusLists,
      now: NOW,
      requireKeyBinding: true,
    });
    expect(report.result).toBe('invalid');
    expect(report.failureCode).toBe('KEY_BINDING_REQUIRED');
  });

  it('does not silently claim binding when none was presented', async () => {
    const report = await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      issuers: directory(),
      statusLists,
      now: NOW,
    });
    expect(report.holderBinding).toBe('not_presented');
    expect(report.result).toBe('valid');
  });
});

describe('failing closed', () => {
  it('does not report valid when the status list cannot be fetched', async () => {
    statusLists.fetchThrows = true;
    const report = await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      issuers: directory(),
      statusLists,
      now: NOW,
    });
    expect(report.result).toBe('undetermined');
    expect(report.failureCode).toBe('STATUS_LIST_UNREACHABLE');
  });

  it('does not report valid when the registry cannot be reached', async () => {
    const report = await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      issuers: {
        basis: 'live',
        resolve: async () => {
          throw new Error('RPC down');
        },
      },
      statusLists,
      now: NOW,
    });
    expect(report.result).toBe('undetermined');
    expect(report.failureCode).toBe('REGISTRY_UNREACHABLE');
  });

  it('warns rather than passes when the list is not anchored on chain', async () => {
    statusLists.chainRecord = undefined;
    const report = await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      issuers: directory(),
      statusLists,
      now: NOW,
    });
    expect(report.result).toBe('undetermined');
    expect(report.status.listHashMatchesChain).toBe(false);
    expect(report.failureCode).toBe('LIST_NOT_ANCHORED');
  });

  it('labels a cached result as cached, with its freshness window', async () => {
    const report = await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      issuers: directory({}, 'cached'),
      statusLists,
      now: NOW,
    });
    expect(report.basis).toBe('cached');
    expect(report.registrySnapshotAt).toBe(new Date((NOW - 3600) * 1000).toISOString());
  });

  it('never leaks a claim value into the evidence of a failed check', async () => {
    const published = await publishList([STATUS_INDEX], 213);
    statusLists.jwt = published.jwt;
    statusLists.chainRecord = published.chain;

    const report = await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      issuers: directory(),
      statusLists,
      now: NOW,
    });

    const evidence = JSON.stringify(report.checks);
    expect(evidence).not.toContain('Ahnaf');
    expect(evidence).not.toContain('2001-04-17');
    expect(evidence).not.toContain('3.71');
  });
});

describe('status list integrity', () => {
  it('rejects a list served from a URL the credential does not point at', async () => {
    const signed = await buildSignedStatusList({
      iss: ISS,
      uri: 'https://evil.example/status/uiu/3',
      orgId: ORG_ID,
      listId: 3,
      version: 213,
      statusPurpose: 'revocation',
      list: createBitstring(),
      issuedAt: NOW - 60,
      signer: issuerSigner,
    });
    statusLists.jwt = signed.jwt;
    statusLists.chainRecord = {
      listHash: signed.payload.listHash,
      uri: STATUS_URI,
      version: 213,
      updatedAt: NOW,
    };

    const report = await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      issuers: directory(),
      statusLists,
      now: NOW,
    });
    expect(report.result).toBe('invalid');
    expect(report.failureCode).toBe('URI_MISMATCH');
  });

  it('rejects a list signed by someone other than the issuer', async () => {
    const impostor = await createLocalSigner((await generateEs256KeyPair()).privateJwk);
    const signed = await buildSignedStatusList({
      iss: ISS,
      uri: STATUS_URI,
      orgId: ORG_ID,
      listId: 3,
      version: 213,
      statusPurpose: 'revocation',
      list: createBitstring(),
      issuedAt: NOW - 60,
      signer: impostor,
    });
    statusLists.jwt = signed.jwt;
    statusLists.chainRecord = {
      listHash: hashEncodedList(signed.payload.encodedList),
      uri: STATUS_URI,
      version: 213,
      updatedAt: NOW,
    };

    const report = await verifyPresentation({
      sdJwt: (await issue()).sdJwt,
      issuers: directory(),
      statusLists,
      now: NOW,
    });
    expect(report.result).toBe('invalid');
    expect(report.failureCode).toBe('BAD_SIGNATURE');
  });
});
