/**
 * The public trust surface. PLAN.html §15, §16.
 *
 * No authentication, cacheable, and deliberately sufficient on its own: a
 * verifier that has a credential, the registry snapshot and a status list can
 * reach the same answer we do without ever calling `/verify` (invariant §25).
 * These endpoints exist so that is actually possible, not just claimed.
 */

import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { listCredentialTypes } from '@civiledger/credential';
import type { AppContext } from '../lib/context.js';
import { badRequest, gone, notFound } from '../lib/errors.js';
import { verify } from '../services/verification.service.js';
import { resolveShareLink } from '../services/share-link.service.js';

const verifyBody = z.object({
  /** A compact SD-JWT presentation. */
  presentation: z.string().min(20).max(120_000).optional(),
  /** Or a share token, which the server narrows to its agreed claim scope. */
  shareToken: z.string().min(10).max(200).optional(),
  expectedAudience: z.string().url().optional(),
  expectedNonce: z.string().min(1).max(200).optional(),
  requireKeyBinding: z.boolean().optional(),
});

export function registerPublicRoutes(app: FastifyInstance, ctx: AppContext): void {
  // --- issuer metadata, per OpenID4VCI -------------------------------------
  app.get('/.well-known/openid-credential-issuer', async (_request, reply) => {
    const base = ctx.config.PUBLIC_BASE_URL.replace(/\/$/, '');
    reply.header('cache-control', 'public, max-age=3600');
    return {
      credential_issuer: base,
      credential_endpoint: `${base}/v1/issuer/credentials`,
      credential_configurations_supported: Object.fromEntries(
        listCredentialTypes().map((type) => [
          type.vct,
          {
            format: 'dc+sd-jwt',
            vct: type.vct,
            display: [{ name: type.displayName, locale: 'en-GB' }],
            cryptographic_binding_methods_supported: ['jwk'],
            credential_signing_alg_values_supported: ['ES256'],
            claims: Object.fromEntries(
              type.disclosableClaims.map((claim) => [
                claim.name,
                { display: [{ name: claim.label, locale: 'en-GB' }], mandatory: claim.required },
              ]),
            ),
          },
        ]),
      ),
    };
  });

  /** The frozen credential-type registry, so integrators can pin against it. */
  app.get('/credential-types', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=3600');
    return {
      types: listCredentialTypes().map((type) => ({
        vct: type.vct,
        displayName: type.displayName,
        frozenAt: type.frozenAt,
        expires: type.expires,
        suspendable: type.suspendable,
        claims: type.disclosableClaims,
      })),
    };
  });

  // --- status lists ---------------------------------------------------------
  app.get<{ Params: { slug: string; listId: string } }>(
    '/status/:slug/:listId',
    async (request, reply) => {
      const listId = Number(request.params.listId);
      if (!Number.isSafeInteger(listId) || listId < 1) {
        throw badRequest('BAD_LIST_ID', 'list id must be a positive integer');
      }

      const organization = await ctx.prisma.organization.findUnique({
        where: { slug: request.params.slug },
        select: { id: true },
      });
      if (!organization) throw notFound('UNKNOWN_ISSUER', 'no such issuer');

      const list = await ctx.prisma.statusList.findFirst({
        where: { organizationId: organization.id, listId },
        select: { signedJwt: true, version: true, updatedAt: true },
      });
      if (!list?.signedJwt)
        throw notFound('STATUS_LIST_NOT_PUBLISHED', 'list has not been published');

      // One hour, per PLAN §9. Long enough to be cheap, short enough that a
      // revocation reaches verifiers inside the window they were promised.
      reply
        .header('content-type', 'application/statuslist+jwt')
        .header('cache-control', 'public, max-age=3600')
        .header('x-status-list-version', String(list.version));
      return reply.send(list.signedJwt);
    },
  );

  // --- anchors --------------------------------------------------------------
  app.get<{ Params: { batchId: string } }>('/anchors/:batchId', async (request, reply) => {
    const batch = await ctx.prisma.batch.findUnique({
      where: { onChainBatchId: request.params.batchId },
      select: {
        onChainBatchId: true,
        merkleRoot: true,
        leafCount: true,
        anchoredAt: true,
        txHash: true,
        state: true,
        organization: { select: { slug: true, legalName: true, orgIdHash: true } },
      },
    });
    if (!batch || batch.state !== 'PUBLISHED') throw notFound('BATCH_NOT_FOUND', 'no such batch');

    reply.header('cache-control', 'public, max-age=86400');
    return {
      batchId: batch.onChainBatchId,
      merkleRoot: batch.merkleRoot,
      leafCount: batch.leafCount,
      anchoredAt: batch.anchoredAt?.toISOString() ?? null,
      txHash: batch.txHash,
      issuer: {
        slug: batch.organization.slug,
        name: batch.organization.legalName,
        orgId: batch.organization.orgIdHash,
      },
    };
  });

  // --- verification ---------------------------------------------------------
  /**
   * Verify a presentation. Rate limited, records nothing.
   *
   * The recorded counterpart lives on the verifier surface, because a recorded
   * verification names a verifier and produces a consent receipt the graduate
   * will see — which is only meaningful if we know who asked.
   */
  app.post(
    '/verify',
    {
      config: {
        rateLimit: { max: ctx.config.VERIFY_RATE_LIMIT_PER_MINUTE, timeWindow: '1 minute' },
      },
    },
    async (request) => {
      const body = verifyBody.parse(request.body);
      const presentation = await resolvePresentation(ctx, body);
      const { report } = await verify(ctx, {
        sdJwt: presentation,
        record: false,
        ...(body.expectedAudience ? { expectedAudience: body.expectedAudience } : {}),
        ...(body.expectedNonce ? { expectedNonce: body.expectedNonce } : {}),
        ...(body.requireKeyBinding !== undefined
          ? { requireKeyBinding: body.requireKeyBinding }
          : {}),
      });
      return report;
    },
  );

  /** Resolve a share link without verifying, so the page can render a preview. */
  app.get<{ Params: { token: string } }>('/share/:token', async (request) => {
    const resolved = await resolveShareLink(ctx, request.params.token);
    return {
      purpose: resolved.purpose,
      claimScope: resolved.claimScope,
      remainingUses: resolved.remainingUses,
    };
  });
}

export async function resolvePresentation(
  ctx: AppContext,
  body: { presentation?: string | undefined; shareToken?: string | undefined },
): Promise<string> {
  if (body.presentation && body.shareToken) {
    throw badRequest('AMBIGUOUS_INPUT', 'send either a presentation or a share token, not both');
  }
  if (body.presentation) return body.presentation;
  if (body.shareToken) {
    const resolved = await resolveShareLink(ctx, body.shareToken);
    return resolved.presentation;
  }
  throw badRequest('NOTHING_TO_VERIFY', 'a presentation or a share token is required');
}

export { gone };
