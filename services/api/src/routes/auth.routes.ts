/**
 * Authentication endpoints for staff and wallet holders.
 */

import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../lib/context.js';
import { principalOf } from '../app.js';
import { loginSubject, loginUser, revokeSession } from '../services/auth.service.js';
import { redeemEnrolmentInvite } from '../services/enrolment.service.js';
import { decryptString } from '../lib/crypto.js';
import { notFound } from '../lib/errors.js';

const loginBody = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(512),
});

const enrolBody = z.object({
  token: z.string().min(16).max(200),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(512),
});

export function registerAuthRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post(
    '/login',
    {
      // Tighter than the global limit: this endpoint is the one worth guessing
      // against, and the cost of an Argon2id verification is ours to pay.
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (request) => {
      const body = loginBody.parse(request.body);
      const result = await loginUser(ctx, body.email, body.password);
      return {
        token: result.token,
        expiresAt: result.expiresAt,
        user: {
          id: result.principal.id,
          role: result.principal.role,
          organizationId: result.principal.organizationId ?? null,
          verifierId: result.principal.verifierId ?? null,
          displayName: result.displayName,
        },
      };
    },
  );

  /** Wallet sign-in for graduates. Same shape, different principal kind. */
  app.post(
    '/wallet/login',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (request) => {
      const body = loginBody.parse(request.body);
      const result = await loginSubject(ctx, body.email, body.password);
      return {
        token: result.token,
        expiresAt: result.expiresAt,
        holder: { id: result.principal.id, displayName: result.displayName },
      };
    },
  );

  /**
   * Claim the credentials an institution issued to you.
   *
   * Signs the graduate straight in afterwards: asking someone to set a
   * password and then immediately type it again is friction with no security
   * value, and this is the first thing they ever do in the product.
   */
  app.post(
    '/wallet/enrol',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const body = enrolBody.parse(request.body);
      await redeemEnrolmentInvite(ctx, body);
      const session = await loginSubject(ctx, body.email, body.password);
      return reply.status(201).send({
        token: session.token,
        expiresAt: session.expiresAt,
        holder: { id: session.principal.id, displayName: session.displayName },
      });
    },
  );

  app.post('/logout', async (request) => {
    if (request.bearerToken) await revokeSession(ctx, request.bearerToken);
    return { ok: true };
  });

  /** Who am I? Re-read from the database, so it reflects suspensions at once. */
  app.get('/me', async (request) => {
    const principal = principalOf(request);
    const user = await ctx.prisma.user.findUnique({
      where: { id: principal.id },
      include: { organization: { select: { slug: true, legalName: true, status: true } } },
    });
    if (!user) throw notFound('USER_NOT_FOUND', 'account no longer exists');

    return {
      id: user.id,
      role: user.role,
      displayName: decryptString(ctx.config.keyRing, user.displayNameEnc),
      organization: user.organization
        ? {
            id: user.organizationId,
            slug: user.organization.slug,
            name: user.organization.legalName,
            status: user.organization.status,
          }
        : null,
      verifierId: user.verifierId,
    };
  });
}
