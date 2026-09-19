/**
 * The verifier surface. PLAN.html §15.
 *
 * The difference between this and the public `/v1/verify` is accountability,
 * not capability: a recorded verification names who asked, and produces a
 * consent receipt the graduate can see in their wallet. That visibility is the
 * defence against a phishing verifier harvesting credentials (PLAN §17).
 */

import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../lib/context.js';
import { principalOf } from '../app.js';
import { forbidden, notFound, tooManyRequests } from '../lib/errors.js';
import { verify } from '../services/verification.service.js';
import { resolvePresentation } from './public.routes.js';
import { decryptJson } from '../lib/crypto.js';
import type { VerificationReport } from '@civiledger/verifier';

const verifyBody = z.object({
  presentation: z.string().min(20).max(120_000).optional(),
  shareToken: z.string().min(10).max(200).optional(),
  expectedAudience: z.string().url().optional(),
  expectedNonce: z.string().min(1).max(200).optional(),
  requireKeyBinding: z.boolean().optional(),
});

export function registerVerifierRoutes(app: FastifyInstance, ctx: AppContext): void {
  /** Verify and record. Requires an API key or a verifier staff session. */
  app.post('/verifier/verify', async (request) => {
    const principal = principalOf(request);
    const verifierId = principal.verifierId;
    if (!verifierId) {
      throw forbidden('NOT_A_VERIFIER', 'this account is not attached to a verifier');
    }

    await assertWithinQuota(ctx, verifierId);

    const body = verifyBody.parse(request.body);
    const presentation = await resolvePresentation(ctx, body);

    const result = await verify(ctx, {
      sdJwt: presentation,
      record: true,
      verifierId,
      ...(body.shareToken ? { shareToken: body.shareToken } : {}),
      ...(body.expectedAudience ? { expectedAudience: body.expectedAudience } : {}),
      ...(body.expectedNonce ? { expectedNonce: body.expectedNonce } : {}),
      ...(body.requireKeyBinding !== undefined
        ? { requireKeyBinding: body.requireKeyBinding }
        : {}),
    });

    return { ...result.report, reportId: result.reportId };
  });

  /** Re-download a report, so it can be attached to a compliance file. */
  app.get<{ Params: { id: string } }>('/reports/:id', async (request) => {
    const principal = principalOf(request);
    const record = await ctx.prisma.verification.findUnique({ where: { id: request.params.id } });
    if (!record?.reportEnc) throw notFound('REPORT_NOT_FOUND', 'no such report');

    // A report carries disclosed claims, so only the verifier that produced it
    // may fetch it back.
    if (record.verifierId !== principal.verifierId) {
      throw forbidden('NOT_YOUR_REPORT', 'this report belongs to another verifier');
    }

    return {
      reportId: record.id,
      createdAt: record.createdAt,
      report: decryptJson<VerificationReport>(ctx.config.keyRing, record.reportEnc),
    };
  });

  app.get<{ Querystring: { skip?: string; take?: string } }>(
    '/verifier/history',
    async (request) => {
      const principal = principalOf(request);
      if (!principal.verifierId) throw forbidden('NOT_A_VERIFIER', 'not a verifier account');

      const where = { verifierId: principal.verifierId };
      const [total, rows] = await Promise.all([
        ctx.prisma.verification.count({ where }),
        ctx.prisma.verification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: Number(request.query.skip ?? 0),
          take: Math.min(Number(request.query.take ?? 50), 200),
          select: {
            id: true,
            result: true,
            failureCode: true,
            basis: true,
            claimScope: true,
            createdAt: true,
            credential: {
              select: {
                vct: true,
                organization: { select: { legalName: true, slug: true } },
              },
            },
          },
        }),
      ]);
      return { total, verifications: rows };
    },
  );

  app.get('/verifier/usage', async (request) => {
    const principal = principalOf(request);
    if (!principal.verifierId) throw forbidden('NOT_A_VERIFIER', 'not a verifier account');

    const verifier = await ctx.prisma.verifier.findUniqueOrThrow({
      where: { id: principal.verifierId },
      select: { plan: true, monthlyQuota: true, kybStatus: true, orgName: true },
    });
    const used = await countThisMonth(ctx, principal.verifierId);

    return {
      organisation: verifier.orgName,
      plan: verifier.plan,
      kybStatus: verifier.kybStatus,
      quota: verifier.monthlyQuota,
      used,
      remaining: verifier.plan === 'ENTERPRISE' ? null : Math.max(verifier.monthlyQuota - used, 0),
    };
  });
}

async function countThisMonth(ctx: AppContext, verifierId: string): Promise<number> {
  const start = new Date(ctx.now() * 1000);
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  return ctx.prisma.verification.count({ where: { verifierId, createdAt: { gte: start } } });
}

/**
 * The free tier is distribution; the cap converts the firms with real volume
 * (PLAN §20.1). Enforced before the work is done, not billed afterwards.
 */
async function assertWithinQuota(ctx: AppContext, verifierId: string): Promise<void> {
  const verifier = await ctx.prisma.verifier.findUniqueOrThrow({
    where: { id: verifierId },
    select: { plan: true, monthlyQuota: true },
  });
  if (verifier.plan === 'ENTERPRISE') return;

  const used = await countThisMonth(ctx, verifierId);
  if (used >= verifier.monthlyQuota) {
    throw tooManyRequests(
      'QUOTA_EXCEEDED',
      `this month's quota of ${verifier.monthlyQuota} verifications is spent`,
    );
  }
}
