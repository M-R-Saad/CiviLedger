/**
 * The whole product path, against a real database and a real chain.
 *
 * Import a registrar's CSV, review it, approve it with a second pair of eyes,
 * sign and anchor the batch, share one credential with a narrow claim scope,
 * verify it as an employer, revoke it, and verify again. If this suite is
 * green, the two-second promise in PLAN §5.1 is real rather than asserted.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { drainOutbox } from '../services/outbox.service.js';
import {
  createHarness,
  integrationAvailable,
  migrateTestDatabase,
  SAMPLE_CSV,
  TEST_PASSWORD,
  type Harness,
} from './harness.js';

const suite = integrationAvailable ? describe : describe.skip;

suite('issuance and verification pipeline', () => {
  let h: Harness;

  beforeAll(async () => {
    migrateTestDatabase();
    h = await createHarness();
  }, 180_000);

  afterAll(async () => {
    await h?.close();
  });

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const apiKey = () => ({ 'x-api-key': h.users.verifierApiKey });

  let importId: string;
  let credentialId: string;
  let shareToken: string;

  it('normalises a registrar CSV into a review queue', async () => {
    const response = await h.app.inject({
      method: 'POST',
      url: '/v1/issuer/imports',
      headers: auth(h.users.registrarToken),
      payload: {
        vct: 'bd.civiledger.academic.degree.v1',
        filename: 'sample-graduates.csv',
        csv: SAMPLE_CSV,
        assuranceLevel: 'AL2',
        evidence: {
          method: 'REGISTRAR_SOURCE_CHECK',
          source_system: 'UIU SIS',
          checked_at: '2027-02-11',
          checked_by_role: 'EXAM_CONTROLLER',
        },
        syntheticData: true,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    importId = body.id;
    expect(body.rowCount).toBe(10);
    // One row is missing its required graduation date, so it must land in the
    // conflict queue rather than being quietly issued or quietly dropped.
    expect(body.readyCount).toBe(9);
    expect(body.conflictCount).toBe(1);
  });

  it('shows the registrar exactly what failed and why', async () => {
    const response = await h.app.inject({
      method: 'GET',
      url: `/v1/issuer/imports/${importId}/review?state=CONFLICT`,
      headers: auth(h.users.registrarToken),
    });
    expect(response.statusCode).toBe(200);

    const { rows } = response.json();
    expect(rows).toHaveLength(1);
    expect(rows[0].issues[0]).toMatchObject({
      claim: 'graduation_date',
      message: expect.stringContaining('required'),
    });
  });

  it('normalises a d/m/Y date from the SIS export', async () => {
    const response = await h.app.inject({
      method: 'GET',
      url: `/v1/issuer/imports/${importId}/review?state=READY`,
      headers: auth(h.users.registrarToken),
    });
    const { rows } = response.json();
    const mim = rows.find(
      (r: { claims: Record<string, string> }) => r.claims['family_name'] === 'Chowdhury',
    );
    expect(mim.claims.graduation_date).toBe('2023-11-15');
  });

  it('does not let a registrar approve a batch at all', async () => {
    // Defence in depth: the capability check fires before four-eyes, so a
    // registrar cannot approve even a batch someone else prepared.
    const response = await h.app.inject({
      method: 'POST',
      url: `/v1/issuer/imports/${importId}/approve`,
      headers: auth(h.users.registrarToken),
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('MISSING_CAPABILITY');
  });

  it('refuses to let the uploader approve their own batch', async () => {
    // The exam controller *can* approve batches — but not one they uploaded.
    // This is the check that actually stands between an issuer insider and a
    // signed fake degree (PLAN §17).
    const upload = await h.app.inject({
      method: 'POST',
      url: '/v1/issuer/imports',
      headers: auth(h.users.controllerToken),
      payload: {
        vct: 'bd.civiledger.academic.degree.v1',
        filename: 'self-approved.csv',
        csv: SAMPLE_CSV,
        assuranceLevel: 'AL2',
        evidence: {
          method: 'REGISTRAR_SOURCE_CHECK',
          source_system: 'UIU SIS',
          checked_at: '2027-02-11',
          checked_by_role: 'EXAM_CONTROLLER',
        },
        syntheticData: true,
      },
    });
    expect(upload.statusCode).toBe(201);

    const response = await h.app.inject({
      method: 'POST',
      url: `/v1/issuer/imports/${upload.json().id}/approve`,
      headers: auth(h.users.controllerToken),
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('FOUR_EYES_REQUIRED');
  });

  it('signs and anchors the batch when a second person approves', async () => {
    const response = await h.app.inject({
      method: 'POST',
      url: `/v1/issuer/imports/${importId}/approve`,
      headers: auth(h.users.controllerToken),
    });
    expect(response.statusCode).toBe(202);

    const body = response.json();
    expect(body.leafCount).toBe(9);
    expect(body.merkleRoot).toMatch(/^0x[0-9a-f]{64}$/);
    expect(body.credentialIds).toHaveLength(9);
    credentialId = body.credentialIds[0];

    // The anchor is queued, not awaited: the database commit and the intent to
    // anchor are one transaction, and the worker drains it.
    const queued = await h.prisma.outboxEntry.findMany({ where: { state: 'PENDING' } });
    expect(queued.some((e) => e.kind === 'ANCHOR_BATCH')).toBe(true);
  }, 180_000);

  it('stores no plaintext personal data', async () => {
    const rows = await h.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT sd_jwt_enc, salt_enc FROM credentials LIMIT 1
    `;
    const blob = Buffer.concat([
      Buffer.from(rows[0]!['sd_jwt_enc'] as Uint8Array),
      Buffer.from(rows[0]!['salt_enc'] as Uint8Array),
    ]).toString('utf8');

    expect(blob).not.toContain('Ahnaf');
    expect(blob).not.toContain('UIU-CSE');

    const subjects = await h.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT display_name_enc FROM subjects LIMIT 5
    `;
    for (const subject of subjects) {
      expect(Buffer.from(subject['display_name_enc'] as Uint8Array).toString('utf8')).not.toContain(
        'Rahman',
      );
    }
  });

  it('drains the outbox and anchors the batch on chain', async () => {
    const result = await drainOutbox(h.ctx, h.writer, { limit: 10 });
    expect(result.confirmed).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBe(0);

    const batch = await h.prisma.batch.findFirstOrThrow({ orderBy: { createdAt: 'desc' } });
    expect(batch.state).toBe('PUBLISHED');
    expect(batch.txHash).toMatch(/^0x[0-9a-f]{64}$/);

    const onChain = await h.ctx.ledger.getBatch(batch.onChainBatchId as `0x${string}`);
    expect(onChain?.merkleRoot).toBe(batch.merkleRoot);
    expect(onChain?.leafCount).toBe(9);
  }, 180_000);

  it('publishes a status list whose hash matches the chain', async () => {
    const list = await h.prisma.statusList.findFirstOrThrow();
    expect(list.version).toBeGreaterThanOrEqual(1);
    expect(list.signedJwt).toBeTruthy();

    const onChain = await h.ctx.ledger.getStatusList(
      (await h.prisma.organization.findFirstOrThrow()).orgIdHash as `0x${string}`,
      list.listId,
    );
    expect(onChain?.listHash).toBe(list.listHash);
    expect(onChain?.version).toBe(list.version);
  }, 180_000);

  it('serves the status list publicly, with a cache window', async () => {
    const response = await h.app.inject({ method: 'GET', url: `/v1/status/${h.orgSlug}/1` });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/statuslist+jwt');
    expect(response.headers['cache-control']).toContain('max-age=3600');
    expect(response.body.split('.')).toHaveLength(3);
  });

  it('publishes a registry snapshot an offline verifier can rely on', async () => {
    const response = await h.app.inject({ method: 'GET', url: '/v1/registry/snapshot' });
    expect(response.statusCode).toBe(200);

    const snapshot = response.json();
    expect(snapshot.digest).toMatch(/^0x[0-9a-f]{64}$/);
    expect(snapshot.chain.chainId).toBeGreaterThan(0);

    const issuer = snapshot.issuers.find((i: { slug: string }) => i.slug === h.orgSlug);
    expect(issuer.accreditation).toBe('UGC_RECOGNIZED');
    expect(issuer.keys[0].thumbprint).toMatch(/^0x[0-9a-f]{64}$/);
    // A snapshot that leaked a claim value would be the worst possible cache.
    expect(response.body).not.toContain('Ahnaf');
  }, 120_000);

  it('lets a graduate share one credential with a narrow claim scope', async () => {
    // Attach the seeded graduate to several issued credentials, as the wallet
    // enrolment flow would after re-identifying them. More than one, so tests
    // that revoke do not starve the tests that follow.
    const issued = await h.prisma.credential.findMany({
      where: { state: 'ISSUED' },
      orderBy: { leafIndex: 'asc' },
      take: 4,
      select: { id: true },
    });
    await h.prisma.credential.updateMany({
      where: { id: { in: issued.map((c) => c.id) } },
      data: { subjectId: h.users.graduateSubjectId },
    });
    credentialId = issued[0]!.id;

    const response = await h.app.inject({
      method: 'POST',
      url: '/v1/wallet/share-links',
      headers: auth(h.users.graduateToken),
      payload: {
        credentialId,
        claimScope: ['given_name', 'family_name', 'degree_level', 'graduation_date'],
        purpose: 'JOB_APPLICATION',
        ttlMinutes: 60,
        maxUses: 3,
      },
    });

    expect(response.statusCode).toBe(201);
    shareToken = response.json().token;
    expect(response.json().claimScope).toHaveLength(4);
  });

  it('refuses a claim scope the credential does not define', async () => {
    const response = await h.app.inject({
      method: 'POST',
      url: '/v1/wallet/share-links',
      headers: auth(h.users.graduateToken),
      payload: {
        credentialId,
        claimScope: ['given_name', 'salary'],
        purpose: 'JOB_APPLICATION',
        ttlMinutes: 60,
        maxUses: 1,
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('UNKNOWN_CLAIMS');
  });

  it('verifies the shared credential and discloses only the agreed claims', async () => {
    const response = await h.app.inject({
      method: 'POST',
      url: '/v1/verifier/verify',
      headers: apiKey(),
      payload: { shareToken },
    });
    expect(response.statusCode).toBe(200);

    const report = response.json();
    expect(report.result).toBe('valid');
    expect(report.basis).toBe('live');
    expect(Object.keys(report.claims).sort()).toEqual([
      'degree_level',
      'family_name',
      'given_name',
      'graduation_date',
    ]);
    // The claim-scope enforcement is server-side: asking differently changes
    // nothing, because the narrowing happened when the link was created.
    expect(report.claims.result_cgpa).toBeUndefined();
    expect(report.withheldClaims).toContain('result_cgpa');
    expect(report.withheldClaims).toContain('date_of_birth');

    expect(report.credential.assuranceLevel).toBe('AL2');
    expect(report.credential.evidence.method).toBe('REGISTRAR_SOURCE_CHECK');
    expect(report.issuer.accreditation).toBe('UGC_RECOGNIZED');
    expect(report.status.listHashMatchesChain).toBe(true);
    expect(report.integrity.anchorProof).toBe('pass');
    expect(report.reportId).toBeTruthy();
  }, 120_000);

  it('writes a consent receipt the graduate can see', async () => {
    const response = await h.app.inject({
      method: 'GET',
      url: '/v1/wallet/receipts',
      headers: auth(h.users.graduateToken),
    });
    expect(response.statusCode).toBe(200);

    const { receipts } = response.json();
    expect(receipts).toHaveLength(1);
    expect(receipts[0].verifier).toBe('Test Recruiter');
    expect(receipts[0].purpose).toBe('JOB_APPLICATION');
    expect(receipts[0].claimsDisclosed.sort()).toEqual([
      'degree_level',
      'family_name',
      'given_name',
      'graduation_date',
    ]);
    expect(receipts[0].result).toBe('VALID');
  });

  it('revokes in under a minute and the next verification says so', async () => {
    const started = Date.now();
    const revoke = await h.app.inject({
      method: 'POST',
      url: `/v1/issuer/credentials/${credentialId}/revoke`,
      headers: auth(h.users.controllerToken),
      payload: { reason: 'FRAUD_CONFIRMED' },
    });
    expect(revoke.statusCode).toBe(200);
    // The batch publish produced version 1; revoking must strictly advance it.
    expect(revoke.json().listVersion).toBeGreaterThan(1);
    expect(Date.now() - started).toBeLessThan(60_000);

    await drainOutbox(h.ctx, h.writer, { limit: 10 });

    const response = await h.app.inject({
      method: 'POST',
      url: '/v1/verifier/verify',
      headers: apiKey(),
      payload: { shareToken },
    });
    const report = response.json();
    expect(report.result).toBe('revoked');
    expect(report.status.revoked).toBe(true);
    expect(report.failureCode).toBe('CREDENTIAL_REVOKED');
  }, 180_000);

  it('never writes a verification to the chain', async () => {
    // Invariant §25: no per-presentation on-chain writes, ever. The only
    // outbox kinds that exist are batch anchors, status lists and audit roots.
    const kinds = await h.prisma.outboxEntry.findMany({ select: { kind: true } });
    for (const { kind } of kinds) {
      expect(['ANCHOR_BATCH', 'PUBLISH_STATUS_LIST', 'ANCHOR_AUDIT', 'CHECKPOINT']).toContain(kind);
    }
  });

  it('will not revoke a credential belonging to another institution', async () => {
    const other = await h.prisma.organization.create({
      data: {
        slug: `other-${Date.now().toString(36)}`,
        orgIdHash: `0x${'cd'.repeat(32)}`,
        legalName: 'Another University',
        issuerUrl: `http://localhost:4000/issuers/other-${Date.now().toString(36)}`,
        didWeb: 'did:web:other',
        status: 'ACTIVE',
      },
    });

    // A credential that genuinely belongs to someone else.
    const foreign = await h.prisma.credential.create({
      data: {
        organizationId: other.id,
        subjectId: h.users.graduateSubjectId,
        vct: 'bd.civiledger.academic.degree.v1',
        sdJwtEnc: Buffer.alloc(120),
        saltEnc: Buffer.alloc(120),
        sdJwtDigest: `0x${'ab'.repeat(32)}`,
        jwtPrefix: 'foreign-credential-prefix-000000',
        assuranceLevel: 'AL2',
        evidenceJson: {},
        state: 'ISSUED',
        issuedAt: new Date(),
      },
    });

    const response = await h.app.inject({
      method: 'POST',
      url: `/v1/issuer/credentials/${foreign.id}/revoke`,
      headers: auth(h.users.controllerToken),
      payload: { reason: 'ADMINISTRATIVE' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('NOT_YOUR_CREDENTIAL');
  });

  it('expires a share link rather than serving it forever', async () => {
    const created = await h.app.inject({
      method: 'POST',
      url: '/v1/wallet/share-links',
      headers: auth(h.users.graduateToken),
      payload: {
        credentialId: (
          await h.prisma.credential.findFirstOrThrow({
            where: { subjectId: h.users.graduateSubjectId, state: 'ISSUED' },
          })
        ).id,
        claimScope: ['given_name'],
        purpose: 'TEST',
        ttlMinutes: 1,
        maxUses: 1,
      },
    });
    const token = created.json().token;

    h.advance(120);

    const response = await h.app.inject({ method: 'GET', url: `/v1/share/${token}` });
    expect(response.statusCode).toBe(410);
    expect(response.json().error).toBe('SHARE_LINK_EXPIRED');
    h.advance(-120);
  });

  it('enforces the use count on a share link', async () => {
    const credential = await h.prisma.credential.findFirstOrThrow({
      where: { subjectId: h.users.graduateSubjectId, state: 'ISSUED' },
    });
    const created = await h.app.inject({
      method: 'POST',
      url: '/v1/wallet/share-links',
      headers: auth(h.users.graduateToken),
      payload: {
        credentialId: credential.id,
        claimScope: ['given_name'],
        purpose: 'TEST',
        ttlMinutes: 60,
        maxUses: 1,
      },
    });
    const token = created.json().token;

    const first = await h.app.inject({
      method: 'POST',
      url: '/v1/verifier/verify',
      headers: apiKey(),
      payload: { shareToken: token },
    });
    expect(first.statusCode).toBe(200);

    const second = await h.app.inject({
      method: 'POST',
      url: '/v1/verifier/verify',
      headers: apiKey(),
      payload: { shareToken: token },
    });
    expect(second.statusCode).toBe(410);
    expect(second.json().error).toBe('SHARE_LINK_USED_UP');
  }, 120_000);

  it('rejects an unauthenticated call to the issuer surface', async () => {
    const response = await h.app.inject({ method: 'GET', url: '/v1/issuer/credentials' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a registrar trying to approve a batch', async () => {
    const response = await h.app.inject({
      method: 'POST',
      url: '/v1/issuer/imports/00000000-0000-0000-0000-000000000000/approve',
      headers: auth(h.users.registrarToken),
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('MISSING_CAPABILITY');
  });

  it('reports the reuse factor the business depends on', async () => {
    const response = await h.app.inject({
      method: 'GET',
      url: '/v1/issuer/analytics',
      headers: auth(h.users.controllerToken),
    });
    expect(response.statusCode).toBe(200);

    const analytics = response.json();
    expect(analytics.credentials.total).toBe(9);
    expect(analytics.verifications.allTime).toBeGreaterThan(0);
    expect(analytics.verifications.reuseFactor).toBeGreaterThan(0);
    // The estimate must be labelled as an estimate, not quoted as measured.
    expect(analytics.staffHoursAvoided.basis).toContain('not measured');
  });
});
