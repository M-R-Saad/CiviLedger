/**
 * The graduate's wallet surface. PLAN.html §5.1, §10, §15.
 *
 * The receipt log is the part worth building carefully. A graduate seeing who
 * verified what, and when, is a genuine differentiator and a direct answer to
 * the PDPA's transparency obligations — and it is the only reason a phishing
 * verifier is discoverable at all.
 */

import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { getCredentialType } from '@civiledger/credential';
import type { AppContext } from '../lib/context.js';
import { principalOf } from '../app.js';
import { forbidden, notFound } from '../lib/errors.js';
import { createShareLink, revokeShareLink } from '../services/share-link.service.js';
import { decryptJson } from '../lib/crypto.js';

const shareBody = z.object({
  credentialId: z.string().uuid(),
  claimScope: z.array(z.string().min(1).max(64)).min(1).max(40),
  purpose: z.string().min(3).max(120),
  ttlMinutes: z.number().int().min(1).max(10_080),
  maxUses: z.number().int().min(1).max(20).default(1),
});

export function registerWalletRoutes(app: FastifyInstance, ctx: AppContext): void {
  /**
   * The wallet holder's own subject id.
   *
   * v1 ships a custodial web wallet (PLAN §3): the graduate signs in and the
   * server holds the credential. Self-custody is an upgrade path, not a
   * prerequisite, so a `user` principal is resolved to its subject here.
   */
  const subjectOf = (request: Parameters<typeof principalOf>[0]): string => {
    const principal = principalOf(request);
    if (principal.kind === 'subject') return principal.id;
    throw forbidden('NOT_A_WALLET_SESSION', 'sign in to your wallet to use this endpoint');
  };

  app.get('/credentials', async (request) => {
    const subjectId = subjectOf(request);
    const credentials = await ctx.prisma.credential.findMany({
      where: { subjectId },
      orderBy: { issuedAt: 'desc' },
      select: {
        id: true,
        vct: true,
        state: true,
        assuranceLevel: true,
        evidenceJson: true,
        issuedAt: true,
        expiresAt: true,
        organization: {
          select: { legalName: true, nameBn: true, slug: true, accreditation: true },
        },
      },
    });

    return {
      credentials: credentials.map((credential) => {
        const definition = getCredentialType(credential.vct);
        return {
          id: credential.id,
          vct: credential.vct,
          displayName: definition?.displayName ?? credential.vct,
          state: credential.state,
          assuranceLevel: credential.assuranceLevel,
          evidence: credential.evidenceJson,
          issuedAt: credential.issuedAt,
          expiresAt: credential.expiresAt,
          issuer: credential.organization,
          /** What the holder may choose to disclose, for the scope picker. */
          disclosableClaims: definition?.disclosableClaims ?? [],
        };
      }),
    };
  });

  app.post('/share-links', async (request, reply) => {
    const subjectId = subjectOf(request);
    const body = shareBody.parse(request.body);

    const link = await createShareLink(ctx, {
      credentialId: body.credentialId,
      subjectId,
      claimScope: body.claimScope,
      purpose: body.purpose,
      ttlMinutes: body.ttlMinutes,
      maxUses: body.maxUses,
    });
    return reply.status(201).send(link);
  });

  app.get('/share-links', async (request) => {
    const subjectId = subjectOf(request);
    const links = await ctx.prisma.shareLink.findMany({
      where: { credential: { subjectId } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        claimScope: true,
        purpose: true,
        expiresAt: true,
        maxUses: true,
        useCount: true,
        revokedAt: true,
        createdAt: true,
        credentialId: true,
      },
    });
    // The token is never returned again — it exists once, at creation.
    return { shareLinks: links };
  });

  app.delete<{ Params: { id: string } }>('/share-links/:id', async (request) => {
    const subjectId = subjectOf(request);
    await revokeShareLink(ctx, request.params.id, subjectId);
    return { ok: true };
  });

  /** Who verified what, when. The transparency feature. */
  app.get<{ Querystring: { skip?: string; take?: string } }>('/receipts', async (request) => {
    const subjectId = subjectOf(request);
    const where = { subjectId };

    const [total, receipts] = await Promise.all([
      ctx.prisma.consentReceipt.count({ where }),
      ctx.prisma.consentReceipt.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: Number(request.query.skip ?? 0),
        take: Math.min(Number(request.query.take ?? 50), 200),
        select: {
          id: true,
          receiptDigest: true,
          receiptEnc: true,
          anchoredIn: true,
          merkleProof: true,
          createdAt: true,
          expiresAt: true,
          verification: {
            select: {
              result: true,
              verifier: { select: { orgName: true } },
              credential: { select: { id: true, vct: true } },
            },
          },
        },
      }),
    ]);

    return {
      total,
      receipts: receipts.map((receipt) => {
        const body = decryptJson<{
          purpose: string;
          claimsDisclosed: string[];
          at: string;
        }>(ctx.config.keyRing, receipt.receiptEnc);

        return {
          id: receipt.id,
          at: body.at,
          purpose: body.purpose,
          claimsDisclosed: body.claimsDisclosed,
          verifier: receipt.verification.verifier?.orgName ?? 'Anonymous verifier',
          result: receipt.verification.result,
          credential: receipt.verification.credential,
          /** Proof this receipt was in a day's anchored root, once anchored. */
          anchored:
            receipt.anchoredIn === null
              ? null
              : {
                  periodStart: Number(receipt.anchoredIn),
                  digest: receipt.receiptDigest,
                  proof: receipt.merkleProof,
                },
          expiresAt: receipt.expiresAt,
        };
      }),
    };
  });

  app.get<{ Params: { id: string } }>('/credentials/:id', async (request) => {
    const subjectId = subjectOf(request);
    const credential = await ctx.prisma.credential.findUnique({
      where: { id: request.params.id },
      include: { organization: { select: { legalName: true, slug: true, accreditation: true } } },
    });
    if (!credential) throw notFound('CREDENTIAL_NOT_FOUND', 'credential not found');
    if (credential.subjectId !== subjectId) {
      throw forbidden('NOT_YOUR_CREDENTIAL', 'this credential is not yours');
    }

    const definition = getCredentialType(credential.vct);
    return {
      id: credential.id,
      vct: credential.vct,
      displayName: definition?.displayName ?? credential.vct,
      state: credential.state,
      assuranceLevel: credential.assuranceLevel,
      evidence: credential.evidenceJson,
      issuedAt: credential.issuedAt,
      expiresAt: credential.expiresAt,
      issuer: credential.organization,
      disclosableClaims: definition?.disclosableClaims ?? [],
    };
  });
}
