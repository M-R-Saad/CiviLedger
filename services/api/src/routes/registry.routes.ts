/**
 * The signed issuer-registry snapshot. PLAN.html §12.3, §16 move 2.
 *
 * Two jobs:
 *
 *   - Publish who can sign what, with chain proofs, so anyone can audit it.
 *   - Let a verifier work offline. A district office with intermittent
 *     connectivity caches this snapshot and the relevant status lists and still
 *     verifies — and its results say they were checked against a snapshot of a
 *     given date, never presented as live (invariant §25).
 */

import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../lib/context.js';
import { notFound, serverError } from '../lib/errors.js';

export interface RegistrySnapshotIssuer {
  orgId: string;
  slug: string;
  iss: string;
  name: string;
  nameBn?: string;
  didWeb: string;
  accreditation: string;
  status: string;
  keys: Array<{
    epoch: number;
    thumbprint: string;
    jwk: unknown;
    validFrom: string;
    validUntil: string | null;
    revocationReason: string | null;
  }>;
}

export interface RegistrySnapshot {
  version: 1;
  generatedAt: string;
  /** How long this snapshot may be relied on before refetching. */
  validUntil: string;
  chain: {
    chainId: number;
    blockNumber: number;
    issuerRegistry: string;
    statusRegistry: string;
    anchorRegistry: string;
    latestCheckpoint?: { stateRoot: string; blockNumber: number; recordedAt: string };
  };
  issuers: RegistrySnapshotIssuer[];
  /** sha-256 over the canonical snapshot, excluding this field. */
  digest: string;
}

const SNAPSHOT_TTL_SECONDS = 3600;

export function registerRegistryRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/registry/snapshot', async (_request, reply) => {
    const snapshot = await buildRegistrySnapshot(ctx);
    reply.header('cache-control', `public, max-age=${SNAPSHOT_TTL_SECONDS}`);
    reply.header('etag', `"${snapshot.digest.slice(0, 32)}"`);
    return snapshot;
  });

  app.get<{ Params: { slug: string } }>('/registry/issuers/:slug', async (request, reply) => {
    const snapshot = await buildRegistrySnapshot(ctx);
    const issuer = snapshot.issuers.find((i) => i.slug === request.params.slug);
    if (!issuer) throw notFound('UNKNOWN_ISSUER', 'no such issuer');
    reply.header('cache-control', `public, max-age=${SNAPSHOT_TTL_SECONDS}`);
    return issuer;
  });

  /**
   * did:web document for an issuer, so a wallet or verifier that speaks DID can
   * resolve our keys through a mechanism it already trusts.
   */
  app.get<{ Params: { slug: string } }>('/issuers/:slug/did.json', async (request, reply) => {
    const org = await ctx.prisma.organization.findUnique({
      where: { slug: request.params.slug },
      include: { issuerKeys: { orderBy: { epoch: 'asc' } } },
    });
    if (!org) throw notFound('UNKNOWN_ISSUER', 'no such issuer');

    reply.header('content-type', 'application/did+ld+json');
    reply.header('cache-control', 'public, max-age=3600');
    return {
      '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/jwk/v1'],
      id: org.didWeb,
      verificationMethod: org.issuerKeys
        // A revoked or superseded epoch stays resolvable for history, but is
        // not advertised as a current verification method.
        .filter((key) => key.validUntil === null && key.revokedReason === null)
        .map((key) => ({
          id: `${org.didWeb}#epoch-${key.epoch}`,
          type: 'JsonWebKey2020',
          controller: org.didWeb,
          publicKeyJwk: key.publicJwk,
        })),
      assertionMethod: org.issuerKeys
        .filter((key) => key.validUntil === null && key.revokedReason === null)
        .map((key) => `${org.didWeb}#epoch-${key.epoch}`),
    };
  });
}

export async function buildRegistrySnapshot(ctx: AppContext): Promise<RegistrySnapshot> {
  const organizations = await ctx.prisma.organization.findMany({
    where: { status: { in: ['ACTIVE', 'SUSPENDED', 'RETIRED'] } },
    include: { issuerKeys: { orderBy: { epoch: 'asc' } } },
    orderBy: { slug: 'asc' },
  });

  let blockNumber: number;
  try {
    blockNumber = await ctx.ledger.blockNumber();
  } catch {
    throw serverError('LEDGER_UNREACHABLE', 'cannot build a snapshot without reading the chain');
  }

  const issuers: RegistrySnapshotIssuer[] = [];
  for (const org of organizations) {
    // Key validity comes from the chain, not from our own table — a snapshot
    // that mirrored our database would prove only that we are self-consistent.
    const onChain = await ctx.ledger.getIssuer(org.orgIdHash as `0x${string}`);
    if (!onChain.exists) continue;
    const epochs = await ctx.ledger.getEpochs(org.orgIdHash as `0x${string}`);

    issuers.push({
      orgId: org.orgIdHash,
      slug: org.slug,
      iss: org.issuerUrl,
      name: org.legalName,
      ...(org.nameBn ? { nameBn: org.nameBn } : {}),
      didWeb: onChain.didWeb,
      accreditation: onChain.accreditation,
      status: onChain.status,
      keys: epochs.map((epoch) => {
        const local = org.issuerKeys.find((k) => k.jwkThumbprint === epoch.jwkThumbprint);
        return {
          epoch: epoch.epoch,
          thumbprint: epoch.jwkThumbprint,
          jwk: local?.publicJwk ?? null,
          validFrom: new Date(epoch.validFrom * 1000).toISOString(),
          validUntil:
            epoch.validUntil === 0 ? null : new Date(epoch.validUntil * 1000).toISOString(),
          revocationReason: decodeReasonBytes(epoch.revocationReason),
        };
      }),
    });
  }

  const checkpoint = await ctx.ledger.latestCheckpoint().catch(() => undefined);
  const generatedAt = ctx.now();

  const body = {
    version: 1 as const,
    generatedAt: new Date(generatedAt * 1000).toISOString(),
    validUntil: new Date((generatedAt + SNAPSHOT_TTL_SECONDS) * 1000).toISOString(),
    chain: {
      chainId: ctx.config.CHAIN_ID,
      blockNumber,
      issuerRegistry: ctx.addresses.IssuerRegistry,
      statusRegistry: ctx.addresses.StatusRegistry,
      anchorRegistry: ctx.addresses.AnchorRegistry,
      ...(checkpoint
        ? {
            latestCheckpoint: {
              stateRoot: checkpoint.stateRoot,
              blockNumber: checkpoint.blockNumber,
              recordedAt: new Date(checkpoint.recordedAt * 1000).toISOString(),
            },
          }
        : {}),
    },
    issuers,
  };

  return { ...body, digest: `0x${createHash('sha256').update(canonical(body)).digest('hex')}` };
}

function decodeReasonBytes(reason: string): string | null {
  if (!reason || /^0x0+$/.test(reason)) return null;
  const bytes = Buffer.from(reason.slice(2), 'hex');
  const end = bytes.indexOf(0);
  const text = bytes.subarray(0, end === -1 ? bytes.length : end).toString('utf8');
  return text.length > 0 ? text : reason;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}
