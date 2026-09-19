/**
 * The Fastify application.
 *
 * Route groups mirror PLAN.html §15: a public trust surface that needs no
 * authentication and is safe to cache, an issuer surface, a verifier surface
 * and a wallet surface.
 */

import Fastify, { type FastifyError, type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { ZodError } from 'zod';
import type { AppContext } from './lib/context.js';
import { AppError, redact } from './lib/errors.js';
import { resolveApiKey, resolveSession, type Principal } from './services/auth.service.js';
import { registerPublicRoutes } from './routes/public.routes.js';
import { registerAuthRoutes } from './routes/auth.routes.js';
import { registerIssuerRoutes } from './routes/issuer.routes.js';
import { registerVerifierRoutes } from './routes/verifier.routes.js';
import { registerWalletRoutes } from './routes/wallet.routes.js';
import { registerRegistryRoutes } from './routes/registry.routes.js';

declare module 'fastify' {
  interface FastifyRequest {
    principal?: Principal;
    /** The raw bearer token, kept so logout can revoke the session. */
    bearerToken?: string;
  }
}

export type App = ReturnType<typeof Fastify>;

export async function buildApp(ctx: AppContext): Promise<App> {
  const app = Fastify({
    logger: {
      level: ctx.config.LOG_LEVEL,
      // PLAN §17: a structured deny-list, not a promise to be careful.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-api-key"]',
          'req.body.password',
          'req.body.csv',
          'req.body.sdJwt',
          'req.body.presentation',
          'res.headers["set-cookie"]',
        ],
        censor: '[redacted]',
      },
      serializers: {
        req: (request) => ({
          method: request.method,
          // Query strings can carry a share token; the path alone is enough.
          url: request.url.split('?')[0] ?? request.url,
          id: request.id,
        }),
      },
    },
    trustProxy: ctx.config.isProduction,
    bodyLimit: 16 * 1024 * 1024,
    disableRequestLogging: false,
    genReqId: () => randomId(),
  });

  await app.register(sensible);
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(cors, {
    origin(origin, callback) {
      // No origin: a server-to-server call or a curl. Allowed — the public
      // surface is meant to be reachable without a browser.
      if (!origin) return callback(null, true);
      callback(null, ctx.config.corsOrigins.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'Idempotency-Key'],
    maxAge: 600,
  });

  await app.register(rateLimit, {
    global: true,
    max: ctx.config.RATE_LIMIT_PER_MINUTE,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.headers['x-api-key']?.toString() ?? request.ip,
  });

  app.decorate('ctx', ctx);

  // --- authentication -------------------------------------------------------
  app.addHook('onRequest', async (request) => {
    const apiKey = request.headers['x-api-key'];
    if (typeof apiKey === 'string' && apiKey.length > 0) {
      request.principal = await resolveApiKey(ctx, apiKey);
      return;
    }
    const authorization = request.headers.authorization;
    if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
      const token = authorization.slice('Bearer '.length).trim();
      request.bearerToken = token;
      request.principal = await resolveSession(ctx, token);
    }
  });

  // --- errors ---------------------------------------------------------------
  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        request.log.error({ err: error, code: error.code }, 'request failed');
      }
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
        ...(error.details ? { details: redact(error.details) } : {}),
        requestId: request.id,
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'VALIDATION_FAILED',
        message: 'the request body did not validate',
        details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        requestId: request.id,
      });
    }

    const fastifyError = error as FastifyError;

    if (fastifyError.statusCode === 429) {
      return reply.status(429).send({
        error: 'RATE_LIMITED',
        message: 'too many requests',
        requestId: request.id,
      });
    }

    if (fastifyError.validation) {
      return reply.status(400).send({
        error: 'VALIDATION_FAILED',
        message: 'the request did not validate',
        requestId: request.id,
      });
    }

    // Anything unrecognised is logged in full and reported as an opaque 500:
    // an internal message can carry a claim value or a query fragment.
    request.log.error({ err: error }, 'unhandled error');
    const status =
      fastifyError.statusCode && fastifyError.statusCode < 500 ? fastifyError.statusCode : 500;
    return reply.status(status).send({
      error: 'INTERNAL_ERROR',
      message: 'something went wrong',
      requestId: request.id,
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: 'NOT_FOUND',
      message: 'no such endpoint',
      requestId: request.id,
    });
  });

  // --- routes ---------------------------------------------------------------
  app.get('/health', async () => ({
    status: 'ok',
    time: new Date(ctx.now() * 1000).toISOString(),
  }));

  app.get('/health/ready', async (_request, reply) => {
    const checks: Record<string, 'ok' | 'down'> = {};
    try {
      await ctx.prisma.$queryRaw`SELECT 1`;
      checks['database'] = 'ok';
    } catch {
      checks['database'] = 'down';
    }
    try {
      await ctx.ledger.blockNumber();
      checks['ledger'] = 'ok';
    } catch {
      checks['ledger'] = 'down';
    }
    const healthy = Object.values(checks).every((v) => v === 'ok');
    return reply.status(healthy ? 200 : 503).send({ status: healthy ? 'ok' : 'degraded', checks });
  });

  await app.register(async (instance) => registerPublicRoutes(instance as FastifyInstance, ctx), {
    prefix: '/v1',
  });
  await app.register(async (instance) => registerRegistryRoutes(instance as FastifyInstance, ctx), {
    prefix: '/v1',
  });
  await app.register(async (instance) => registerAuthRoutes(instance as FastifyInstance, ctx), {
    prefix: '/v1/auth',
  });
  await app.register(async (instance) => registerIssuerRoutes(instance as FastifyInstance, ctx), {
    prefix: '/v1/issuer',
  });
  await app.register(async (instance) => registerVerifierRoutes(instance as FastifyInstance, ctx), {
    prefix: '/v1',
  });
  await app.register(async (instance) => registerWalletRoutes(instance as FastifyInstance, ctx), {
    prefix: '/v1/wallet',
  });

  return app;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Require an authenticated principal, or fail the request. */
export function principalOf(request: FastifyRequest): Principal {
  if (!request.principal) {
    throw new AppError(401, 'UNAUTHENTICATED', 'authentication required');
  }
  return request.principal;
}

declare module 'fastify' {
  interface FastifyInstance {
    ctx: AppContext;
  }
}
