import { describe, expect, it, beforeAll } from 'vitest';
import { createDisclosure, digestOf, parseDisclosure } from './disclosure.js';
import { issueCredential } from './issue.js';
import { parseSdJwt, presentCredential } from './present.js';
import { createLocalSigner, generateEs256KeyPair, type CredentialSigner } from './signer.js';
import { CredentialError, type AlwaysVisibleClaims, type JwkPublicEc } from './types.js';
import { verifyCredential, type IssuerKeyResolution } from './verify.js';
import { validateClaims, ACADEMIC_DEGREE_V1, PROFESSIONAL_LICENCE_V1 } from './vct.js';

const ISS = 'https://civiledger.com.bd/issuers/uiu';
const VCT = ACADEMIC_DEGREE_V1.vct;
const NOW = 1_800_000_000;

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
  name_bn: 'আহনাফ রহমান',
  date_of_birth: '2001-04-17',
  national_id_last4: '4821',
  programme: 'BSc in Computer Science and Engineering',
  degree_level: 'BACHELOR',
  major: 'Software Engineering',
  result_cgpa: 3.71,
  result_class: 'FIRST_CLASS',
  graduation_date: '2024-11-30',
  registration_no: 'UIU-CSE-2019-0412',
};

let issuerSigner: CredentialSigner;
let issuerPublicJwk: JwkPublicEc;
let holderSigner: CredentialSigner;
let holderPublicJwk: JwkPublicEc;
let otherPublicJwk: JwkPublicEc;

beforeAll(async () => {
  const issuer = await generateEs256KeyPair();
  issuerSigner = await createLocalSigner(issuer.privateJwk, 'uiu-epoch-1');
  issuerPublicJwk = issuer.publicJwk;

  const holder = await generateEs256KeyPair();
  holderSigner = await createLocalSigner(holder.privateJwk);
  holderPublicJwk = holder.publicJwk;

  otherPublicJwk = (await generateEs256KeyPair()).publicJwk;
});

/** A registry that says "this key was valid then". Overridden per test. */
function resolver(overrides: Partial<IssuerKeyResolution> = {}) {
  return async (): Promise<IssuerKeyResolution> => ({
    jwk: issuerPublicJwk,
    thumbprint: issuerSigner.thumbprint,
    validAtSigningTime: true,
    ...overrides,
  });
}

async function issue(overrides: Partial<Parameters<typeof issueCredential>[0]> = {}) {
  return issueCredential({
    iss: ISS,
    vct: VCT,
    claims: CLAIMS,
    alwaysVisible: ALWAYS_VISIBLE,
    holderJwk: holderPublicJwk,
    issuedAt: NOW - 86_400,
    expiresAt: null,
    signer: issuerSigner,
    status: { status_list: { idx: 41_297, uri: 'https://civiledger.com.bd/status/uiu/3' } },
    ...overrides,
  });
}

describe('disclosures', () => {
  it('digests the encoded string, not a re-serialisation of the value', () => {
    const d = createDisclosure('given_name', 'Ahnaf');
    expect(d.digest).toBe(digestOf(d.encoded));
    // Round-tripping through parse must not change the digest.
    expect(parseDisclosure(d.encoded).digest).toBe(d.digest);
  });

  it('rejects reserved claim names', () => {
    expect(() => createDisclosure('_sd', 'x')).toThrow(CredentialError);
    expect(() => createDisclosure('_sd_alg', 'x')).toThrow(CredentialError);
  });

  it('rejects malformed disclosures', () => {
    expect(() => parseDisclosure('not base64url!!')).toThrow(/base64url/);
    expect(() => parseDisclosure(Buffer.from('{"a":1}').toString('base64url'))).toThrow(
      /JSON array/,
    );
    expect(() => parseDisclosure(Buffer.from('["salt","name"]').toString('base64url'))).toThrow(
      /3-element/,
    );
  });

  it('produces a different salt every time', () => {
    const a = createDisclosure('given_name', 'Ahnaf');
    const b = createDisclosure('given_name', 'Ahnaf');
    expect(a.salt).not.toBe(b.salt);
    expect(a.digest).not.toBe(b.digest);
  });
});

describe('vct validation', () => {
  it('accepts a well-formed claim set', () => {
    expect(validateClaims(VCT, CLAIMS)).toEqual([]);
  });

  it('reports every problem at once, not just the first', () => {
    const issues = validateClaims(VCT, {
      ...CLAIMS,
      given_name: undefined,
      degree_level: 'HONORARY',
      result_cgpa: 9,
      graduation_date: '30-11-2024',
      unexpected_claim: 'x',
    });
    const byClaim = Object.fromEntries(issues.map((i) => [i.claim, i.message]));
    expect(byClaim['given_name']).toMatch(/required/);
    expect(byClaim['degree_level']).toMatch(/expected one of/);
    expect(byClaim['result_cgpa']).toMatch(/at most 5/);
    expect(byClaim['graduation_date']).toMatch(/ISO date/);
    expect(byClaim['unexpected_claim']).toMatch(/not part of/);
  });

  it('rejects a calendar-shaped but impossible date', () => {
    const issues = validateClaims(VCT, { ...CLAIMS, graduation_date: '2024-13-45' });
    expect(issues.some((i) => i.claim === 'graduation_date')).toBe(true);
  });
});

describe('issuance', () => {
  it('issues a credential whose _sd hides claim order and count', async () => {
    const credential = await issue({ decoyCount: 4 });
    const sd = credential.signedPayload['_sd'] as string[];
    expect(sd).toEqual([...sd].sort());
    expect(sd.length).toBe(credential.disclosures.length + 4);
    expect(credential.sdJwt.endsWith('~')).toBe(true);
  });

  it('keeps assurance level and evidence outside the disclosable set', async () => {
    const credential = await issue();
    expect(credential.signedPayload['assurance_level']).toBe('AL2');
    expect(credential.signedPayload['evidence']).toMatchObject({
      method: 'REGISTRAR_SOURCE_CHECK',
    });
    expect(credential.disclosures.map((d) => d.claimName)).not.toContain('assurance_level');
  });

  it('puts no claim values in the signed payload', async () => {
    const credential = await issue();
    const serialised = JSON.stringify(credential.signedPayload);
    expect(serialised).not.toContain('Ahnaf');
    expect(serialised).not.toContain('4821');
    expect(serialised).not.toContain('UIU-CSE-2019-0412');
  });

  it('refuses to publish an AL0 credential', async () => {
    await expect(
      issue({ alwaysVisible: { ...ALWAYS_VISIBLE, assurance_level: 'AL0' } }),
    ).rejects.toThrow(/AL0/);
  });

  it('refuses an expiry on a type that does not expire', async () => {
    await expect(issue({ expiresAt: NOW + 1000 })).rejects.toThrow(/do not expire/);
  });

  it('requires an expiry on a type that does expire', async () => {
    await expect(
      issueCredential({
        iss: ISS,
        vct: PROFESSIONAL_LICENCE_V1.vct,
        claims: {
          given_name: 'Sumaya',
          family_name: 'Akter',
          date_of_birth: '1990-01-02',
          licence_number: 'BMDC-A-12345',
          profession: 'Physician',
          standing: 'GOOD_STANDING',
        },
        alwaysVisible: { ...ALWAYS_VISIBLE, accreditation: 'PROFESSIONAL_BODY' },
        issuedAt: NOW,
        expiresAt: null,
        signer: issuerSigner,
      }),
    ).rejects.toThrow(/must carry an expiry/);
  });

  it('refuses claims that fail the frozen schema', async () => {
    await expect(issue({ claims: { ...CLAIMS, result_cgpa: 99 } })).rejects.toMatchObject({
      code: 'CLAIMS_INVALID',
      message: expect.stringContaining('result_cgpa must be at most 5'),
    });
  });
});

describe('presentation and verification', () => {
  it('verifies a full presentation and reconstructs the claims', async () => {
    const credential = await issue();
    const result = await verifyCredential({
      sdJwt: credential.sdJwt,
      resolveIssuerKey: resolver(),
      now: NOW,
    });
    expect(result.disclosedClaims['given_name']).toBe('Ahnaf');
    expect(result.disclosedClaims['result_cgpa']).toBe(3.71);
    expect(result.disclosedClaims['name_bn']).toBe('আহনাফ রহমান');
    expect(result.withheldClaimNames).toEqual(['transcript_digest', 'photo_digest']);
    expect(result.vctRecognised).toBe(true);
    expect(result.holderBinding).toBe('not_presented');
  });

  it('honours a narrow claim scope and reports what was withheld', async () => {
    const credential = await issue();
    const presentation = await presentCredential({
      issuedSdJwt: credential.sdJwt,
      claimScope: ['given_name', 'family_name', 'degree_level', 'graduation_date'],
    });

    const result = await verifyCredential({
      sdJwt: presentation,
      resolveIssuerKey: resolver(),
      now: NOW,
    });

    expect(Object.keys(result.disclosedClaims).sort()).toEqual([
      'degree_level',
      'family_name',
      'given_name',
      'graduation_date',
    ]);
    expect(result.disclosedClaims['result_cgpa']).toBeUndefined();
    expect(result.withheldClaimNames).toContain('result_cgpa');
    expect(result.withheldClaimNames).toContain('date_of_birth');
    // The withheld values must not survive anywhere in the wire format.
    expect(presentation).not.toContain(Buffer.from(JSON.stringify('3.71')).toString('base64url'));
  });

  it('ignores a requested claim the credential does not carry', async () => {
    const credential = await issue({ claims: { ...CLAIMS, major: undefined } });
    const presentation = await presentCredential({
      issuedSdJwt: credential.sdJwt,
      claimScope: ['given_name', 'major'],
    });
    const result = await verifyCredential({
      sdJwt: presentation,
      resolveIssuerKey: resolver(),
      now: NOW,
    });
    expect(Object.keys(result.disclosedClaims)).toEqual(['given_name']);
  });

  it('rejects a tampered claim value', async () => {
    const credential = await issue();
    const parsed = parseSdJwt(credential.sdJwt);
    const forged = createDisclosure('result_cgpa', 4.0);
    const tampered = `${parsed.jwt}~${forged.encoded}~`;

    await expect(
      verifyCredential({ sdJwt: tampered, resolveIssuerKey: resolver(), now: NOW }),
    ).rejects.toThrow(/not one the issuer signed/);
  });

  it('rejects a tampered signed payload', async () => {
    const credential = await issue();
    const [header, payload, signature] = credential.jwt.split('.');
    const decoded = JSON.parse(Buffer.from(payload!, 'base64url').toString());
    decoded.assurance_level = 'AL3+';
    const forgedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');

    await expect(
      verifyCredential({
        sdJwt: `${header}.${forgedPayload}.${signature}~`,
        resolveIssuerKey: resolver(),
        now: NOW,
      }),
    ).rejects.toThrow(/signature does not verify/);
  });

  it('rejects a credential signed by a key the registry does not vouch for', async () => {
    const credential = await issue();
    await expect(
      verifyCredential({
        sdJwt: credential.sdJwt,
        resolveIssuerKey: async () => ({
          jwk: otherPublicJwk,
          thumbprint: 'other',
          validAtSigningTime: true,
        }),
        now: NOW,
      }),
    ).rejects.toThrow(/signature does not verify/);
  });

  it('rejects a good signature from a key that was not valid at signing time', async () => {
    const credential = await issue();
    await expect(
      verifyCredential({
        sdJwt: credential.sdJwt,
        resolveIssuerKey: resolver({
          validAtSigningTime: false,
          revocationReason: 'KEY_COMPROMISE',
        }),
        now: NOW,
      }),
    ).rejects.toThrow(/KEY_COMPROMISE/);
  });

  it('passes the credential iat to the registry, not the current time', async () => {
    const issuedAt = NOW - 5 * 365 * 86_400;
    const credential = await issue({ issuedAt });
    let seen: number | undefined;
    await verifyCredential({
      sdJwt: credential.sdJwt,
      resolveIssuerKey: async ({ issuedAt: ts }) => {
        seen = ts;
        return {
          jwk: issuerPublicJwk,
          thumbprint: issuerSigner.thumbprint,
          validAtSigningTime: true,
        };
      },
      now: NOW,
    });
    expect(seen).toBe(issuedAt);
  });

  it('rejects an expired credential', async () => {
    const credential = await issueCredential({
      iss: ISS,
      vct: PROFESSIONAL_LICENCE_V1.vct,
      claims: {
        given_name: 'Sumaya',
        family_name: 'Akter',
        date_of_birth: '1990-01-02',
        licence_number: 'BMDC-A-12345',
        profession: 'Physician',
        standing: 'GOOD_STANDING',
      },
      alwaysVisible: { ...ALWAYS_VISIBLE, accreditation: 'PROFESSIONAL_BODY' },
      issuedAt: NOW - 1000,
      expiresAt: NOW - 100,
      signer: issuerSigner,
    });

    await expect(
      verifyCredential({ sdJwt: credential.sdJwt, resolveIssuerKey: resolver(), now: NOW }),
    ).rejects.toThrow(/expired/);
  });

  it('rejects a duplicated disclosure', async () => {
    const credential = await issue();
    const parsed = parseSdJwt(credential.sdJwt);
    const first = parsed.disclosures[0]!.encoded;
    await expect(
      verifyCredential({
        sdJwt: `${parsed.jwt}~${first}~${first}~`,
        resolveIssuerKey: resolver(),
        now: NOW,
      }),
    ).rejects.toThrow(/twice/);
  });
});

describe('holder binding', () => {
  it('verifies a key-bound presentation', async () => {
    const credential = await issue();
    const presentation = await presentCredential({
      issuedSdJwt: credential.sdJwt,
      claimScope: ['given_name', 'family_name'],
      keyBinding: {
        audience: 'https://verifier.example/bd',
        nonce: 'n-0S6_WzA2Mj',
        issuedAt: NOW,
        signer: holderSigner,
      },
    });

    const result = await verifyCredential({
      sdJwt: presentation,
      resolveIssuerKey: resolver(),
      now: NOW,
      expectedAudience: 'https://verifier.example/bd',
      expectedNonce: 'n-0S6_WzA2Mj',
      requireKeyBinding: true,
    });

    expect(result.holderBinding).toBe('verified');
    expect(result.keyBinding).toEqual({
      audience: 'https://verifier.example/bd',
      nonce: 'n-0S6_WzA2Mj',
      issuedAt: NOW,
    });
  });

  it('rejects a key-binding JWT replayed against a different claim scope', async () => {
    const credential = await issue();
    const narrow = await presentCredential({
      issuedSdJwt: credential.sdJwt,
      claimScope: ['given_name'],
      keyBinding: {
        audience: 'https://verifier.example/bd',
        nonce: 'nonce-1',
        issuedAt: NOW,
        signer: holderSigner,
      },
    });

    // Splice the captured KB-JWT onto a presentation carrying more claims.
    const kbJwt = narrow.slice(narrow.lastIndexOf('~') + 1);
    const wide = await presentCredential({
      issuedSdJwt: credential.sdJwt,
      claimScope: ['given_name', 'result_cgpa'],
    });

    await expect(
      verifyCredential({
        sdJwt: `${wide}${kbJwt}`,
        resolveIssuerKey: resolver(),
        now: NOW,
        requireKeyBinding: true,
      }),
    ).rejects.toThrow(/does not cover the presented disclosures/);
  });

  it('rejects a key-binding JWT addressed to a different verifier', async () => {
    const credential = await issue();
    const presentation = await presentCredential({
      issuedSdJwt: credential.sdJwt,
      claimScope: ['given_name'],
      keyBinding: {
        audience: 'https://other-verifier.example',
        nonce: 'nonce-1',
        issuedAt: NOW,
        signer: holderSigner,
      },
    });

    await expect(
      verifyCredential({
        sdJwt: presentation,
        resolveIssuerKey: resolver(),
        now: NOW,
        expectedAudience: 'https://verifier.example/bd',
        requireKeyBinding: true,
      }),
    ).rejects.toThrow(/addressed to another verifier/);
  });

  it('rejects a stale key-binding JWT', async () => {
    const credential = await issue();
    const presentation = await presentCredential({
      issuedSdJwt: credential.sdJwt,
      claimScope: ['given_name'],
      keyBinding: {
        audience: 'https://verifier.example/bd',
        nonce: 'nonce-1',
        issuedAt: NOW - 3600,
        signer: holderSigner,
      },
    });

    await expect(
      verifyCredential({
        sdJwt: presentation,
        resolveIssuerKey: resolver(),
        now: NOW,
        requireKeyBinding: true,
      }),
    ).rejects.toThrow(/too old/);
  });

  it('rejects a key-binding JWT signed by the wrong holder key', async () => {
    const credential = await issue();
    const impostor = await createLocalSigner((await generateEs256KeyPair()).privateJwk);
    const presentation = await presentCredential({
      issuedSdJwt: credential.sdJwt,
      claimScope: ['given_name'],
      keyBinding: {
        audience: 'https://verifier.example/bd',
        nonce: 'nonce-1',
        issuedAt: NOW,
        signer: impostor,
      },
    });

    await expect(
      verifyCredential({
        sdJwt: presentation,
        resolveIssuerKey: resolver(),
        now: NOW,
        requireKeyBinding: true,
      }),
    ).rejects.toThrow(/key-binding signature does not verify/);
  });

  it('fails closed when binding is required but not presented', async () => {
    const credential = await issue();
    await expect(
      verifyCredential({
        sdJwt: credential.sdJwt,
        resolveIssuerKey: resolver(),
        now: NOW,
        requireKeyBinding: true,
      }),
    ).rejects.toThrow(/requires holder binding/);
  });
});
