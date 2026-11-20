/**
 * The Issuer Console surface. PLAN.html §5.1, §15.
 *
 * What a registrar does here: import records, review what normalised cleanly,
 * approve a batch (which someone else prepared), revoke, and see the dashboard
 * that makes the case to their vice-chancellor — verifications answered,
 * staff-hours avoided, revenue share accrued.
 */

import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { EVIDENCE_METHODS } from '@civiledger/credential';
import type { AppContext } from '../lib/context.js';
import { principalOf } from '../app.js';
import { requireCapability, type Principal } from '../services/auth.service.js';
import { forbidden, notFound } from '../lib/errors.js';
import {
  approveAndSignBatch,
  createImport,
  listImportRows,
  MAX_IMPORT_ROWS,
} from '../services/issuance.service.js';
import { REVOCATION_REASONS, revokeCredential } from '../services/revocation.service.js';
import { createEnrolmentInvite } from '../services/enrolment.service.js';
import { decryptString } from '../lib/crypto.js';

const createImportBody = z.object({
  vct: z.string().min(3).max(120),
  filename: z.string().min(1).max(255),
  csv: z
    .string()
    .min(1)
    .max(12 * 1024 * 1024),
  assuranceLevel: z.enum(['AL1', 'AL2', 'AL3', 'AL3_PLUS']),
  evidence: z.object({
    method: z.enum(EVIDENCE_METHODS),
    source_system: z.string().min(1).max(120),
    checked_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checked_by_role: z.string().min(1).max(80),
    note: z.string().max(400).optional(),
  }),
  /** The registrar asserts this file contains no real graduate data. */
  syntheticData: z.boolean(),
});

const revokeBody = z.object({
  reason: z.enum(REVOCATION_REASONS),
});

export function registerIssuerRoutes(app: FastifyInstance, ctx: AppContext): void {
  const orgOf = (principal: Principal): string => {
    if (!principal.organizationId) {
      throw forbidden('NO_ORGANISATION', 'this account is not attached to an institution');
    }
    return principal.organizationId;
  };

  // --- imports --------------------------------------------------------------
  app.post('/imports', async (request, reply) => {
    const principal = principalOf(request);
    requireCapability(principal, 'import:create');
    const body = createImportBody.parse(request.body);

    const summary = await createImport(ctx, {
      organizationId: orgOf(principal),
      vct: body.vct,
      filename: body.filename,
      csv: body.csv,
      assuranceLevel: body.assuranceLevel,
      evidence: {
        method: body.evidence.method,
        source_system: body.evidence.source_system,
        checked_at: body.evidence.checked_at,
        checked_by_role: body.evidence.checked_by_role,
        ...(body.evidence.note === undefined ? {} : { note: body.evidence.note }),
      },
      uploadedById: principal.id,
      syntheticData: body.syntheticData,
    });

    return reply.status(201).send({ ...summary, maxRows: MAX_IMPORT_ROWS });
  });

  app.get('/imports', async (request) => {
    const principal = principalOf(request);
    requireCapability(principal, 'import:read');
    const imports = await ctx.prisma.credentialImport.findMany({
      where: { organizationId: orgOf(principal) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        filename: true,
        vct: true,
        state: true,
        rowCount: true,
        readyCount: true,
        conflictCount: true,
        assuranceLevel: true,
        createdAt: true,
        uploadedById: true,
      },
    });
    return { imports };
  });

  app.get<{
    Params: { id: string };
    Querystring: { state?: string; skip?: string; take?: string };
  }>('/imports/:id/review', async (request) => {
    const principal = principalOf(request);
    requireCapability(principal, 'import:read');
    return listImportRows(ctx, request.params.id, orgOf(principal), {
      ...(request.query.state ? { state: request.query.state } : {}),
      skip: Number(request.query.skip ?? 0),
      take: Number(request.query.take ?? 100),
    });
  });

  // --- batches --------------------------------------------------------------
  /**
   * Approve, sign and queue the anchor for an import.
   *
   * Four-eyes is enforced in the service, not here: it is a property of the
   * batch, not of this endpoint, and must hold however the batch is approved.
   */
  app.post<{ Params: { id: string } }>('/imports/:id/approve', async (request, reply) => {
    const principal = principalOf(request);
    requireCapability(principal, 'batch:approve');

    const result = await approveAndSignBatch(ctx, {
      importId: request.params.id,
      organizationId: orgOf(principal),
      approvedById: principal.id,
    });
    return reply.status(202).send({
      ...result,
      state: 'ANCHORING',
      message: 'credentials signed; the batch anchor is queued',
    });
  });

  app.get('/batches', async (request) => {
    const principal = principalOf(request);
    requireCapability(principal, 'credential:read');
    const batches = await ctx.prisma.batch.findMany({
      where: { organizationId: orgOf(principal) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        state: true,
        merkleRoot: true,
        leafCount: true,
        onChainBatchId: true,
        txHash: true,
        anchoredAt: true,
        approvedById: true,
        preparedById: true,
        failureReason: true,
        createdAt: true,
      },
    });
    return { batches };
  });

  // --- credentials ----------------------------------------------------------
  app.get<{ Querystring: { skip?: string; take?: string; state?: string } }>(
    '/credentials',
    async (request) => {
      const principal = principalOf(request);
      requireCapability(principal, 'credential:read');
      const organizationId = orgOf(principal);

      const where = {
        organizationId,
        ...(request.query.state ? { state: request.query.state as never } : {}),
      };
      const [total, credentials] = await Promise.all([
        ctx.prisma.credential.count({ where }),
        ctx.prisma.credential.findMany({
          where,
          orderBy: { issuedAt: 'desc' },
          skip: Number(request.query.skip ?? 0),
          take: Math.min(Number(request.query.take ?? 50), 200),
          select: {
            id: true,
            vct: true,
            state: true,
            assuranceLevel: true,
            issuedAt: true,
            expiresAt: true,
            revokedAt: true,
            revokedReason: true,
            batchId: true,
            subject: { select: { id: true, displayNameEnc: true } },
          },
        }),
      ]);

      return {
        total,
        credentials: credentials.map((c) => ({
          id: c.id,
          vct: c.vct,
          state: c.state,
          assuranceLevel: c.assuranceLevel,
          issuedAt: c.issuedAt,
          expiresAt: c.expiresAt,
          revokedAt: c.revokedAt,
          revokedReason: c.revokedReason,
          batchId: c.batchId,
          subjectId: c.subject.id,
          // Decrypted only for the institution that issued it, and only the
          // display name — never the full claim set in a list view.
          subjectName: decryptString(ctx.config.keyRing, c.subject.displayNameEnc),
        })),
      };
    },
  );

  app.post<{ Params: { id: string } }>('/credentials/:id/revoke', async (request) => {
    const principal = principalOf(request);
    requireCapability(principal, 'credential:revoke');
    const body = revokeBody.parse(request.body);

    return revokeCredential(ctx, {
      credentialId: request.params.id,
      organizationId: orgOf(principal),
      reason: body.reason,
      actorUserId: principal.id,
    });
  });

  /**
   * Mint a one-time enrolment token for the holder of this credential.
   *
   * Returned once and never stored in readable form; the institution delivers
   * it to the graduate through a channel it already uses for them.
   */
  app.post<{ Params: { id: string } }>('/credentials/:id/invite', async (request, reply) => {
    const principal = principalOf(request);
    requireCapability(principal, 'credential:read');

    const invite = await createEnrolmentInvite(ctx, {
      credentialId: request.params.id,
      organizationId: orgOf(principal),
      actorUserId: principal.id,
    });
    return reply.status(201).send(invite);
  });

  app.get<{ Params: { id: string } }>('/credentials/:id/history', async (request) => {
    const principal = principalOf(request);
    requireCapability(principal, 'credential:read');

    const credential = await ctx.prisma.credential.findUnique({
      where: { id: request.params.id },
      select: { organizationId: true },
    });
    if (!credential) throw notFound('CREDENTIAL_NOT_FOUND', 'credential not found');
    if (credential.organizationId !== orgOf(principal)) {
      throw forbidden('NOT_YOUR_CREDENTIAL', 'this credential belongs to another institution');
    }

    const events = await ctx.prisma.credentialStatusEvent.findMany({
      where: { credentialId: request.params.id },
      orderBy: { createdAt: 'asc' },
    });
    return { events };
  });

  // --- the dashboard the registrar shows their vice-chancellor --------------
  app.get('/analytics', async (request) => {
    const principal = principalOf(request);
    requireCapability(principal, 'analytics:read');
    const organizationId = orgOf(principal);

    const since = new Date((ctx.now() - 30 * 86_400) * 1000);
    const [issued, revoked, org, verifications, recentVerifications] = await Promise.all([
      ctx.prisma.credential.count({ where: { organizationId, state: 'ISSUED' } }),
      ctx.prisma.credential.count({ where: { organizationId, state: 'REVOKED' } }),
      ctx.prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { revenueShareBps: true, legalName: true, slug: true },
      }),
      ctx.prisma.verification.count({ where: { credential: { organizationId } } }),
      ctx.prisma.verification.count({
        where: { credential: { organizationId }, createdAt: { gte: since } },
      }),
    ]);

    // PLAN §22 sets the baseline at roughly 45 minutes of registrar time per
    // manual verification. It is an estimate from the pilot, labelled as one,
    // not a number to quote as measured fact.
    const MINUTES_SAVED_PER_VERIFICATION = 45;

    return {
      organization: { name: org.legalName, slug: org.slug },
      credentials: { issued, revoked, total: issued + revoked },
      verifications: {
        allTime: verifications,
        last30Days: recentVerifications,
        // The ratio the business lives or dies on (PLAN §20.3).
        reuseFactor: issued === 0 ? 0 : Number((verifications / issued).toFixed(2)),
      },
      staffHoursAvoided: {
        estimate: Number(((verifications * MINUTES_SAVED_PER_VERIFICATION) / 60).toFixed(1)),
        basis: `${MINUTES_SAVED_PER_VERIFICATION} minutes per manual verification (pilot estimate, not measured)`,
      },
      revenueShare: {
        bps: org.revenueShareBps,
        note: 'accrual reporting begins when paid verification is enabled',
      },
    };
  });
}
