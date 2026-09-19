/**
 * The transactional outbox for ledger writes.
 *
 * The system this replaces anchored on chain first and wrote the database
 * second, so a database failure permanently orphaned an on-chain anchor with
 * nothing to reconcile it against — and the only recovery was a log line
 * asking a human to notice.
 *
 * Here the database commit and the intent to anchor are one transaction, and
 * this drains that intent afterwards. Retrying is safe because every registry
 * write is either idempotent (`anchorBatch` derives its id from the content and
 * reverts on a repeat) or version-guarded (`publishStatusList` refuses a
 * version that does not strictly increase).
 */

import type { Hex } from 'viem';
import type { LedgerWriter } from '@civiledger/chain';
import type { AppContext } from '../lib/context.js';

/**
 * Returned when an entry no longer needs sending because the chain has already
 * moved past it. Distinct from success: nothing was broadcast.
 */
const SUPERSEDED = Symbol('superseded');

export const OUTBOX_KINDS = [
  'ANCHOR_BATCH',
  'PUBLISH_STATUS_LIST',
  'ANCHOR_AUDIT',
  'CHECKPOINT',
] as const;
export type OutboxKind = (typeof OUTBOX_KINDS)[number];

export interface DrainOptions {
  limit?: number;
  /** How long a worker holds a row before another may retry it. */
  leaseSeconds?: number;
  maxAttempts?: number;
}

export interface DrainResult {
  claimed: number;
  confirmed: number;
  failed: number;
  errors: Array<{ id: string; kind: string; message: string }>;
}

const BACKOFF_SECONDS = [5, 30, 120, 600, 1800];

export async function drainOutbox(
  ctx: AppContext,
  writer: LedgerWriter,
  options: DrainOptions = {},
): Promise<DrainResult> {
  const { limit = 25, leaseSeconds = 300, maxAttempts = 8 } = options;
  const now = new Date(ctx.now() * 1000);
  const leaseUntil = new Date((ctx.now() + leaseSeconds) * 1000);

  // Claim rows with a lease so two workers cannot send the same transaction.
  // `FOR UPDATE SKIP LOCKED` is what makes that safe without a global lock.
  const claimed = await ctx.prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE outbox_entries SET state = 'IN_FLIGHT', leased_until = ${leaseUntil}, updated_at = ${now}
    WHERE id IN (
      SELECT id FROM outbox_entries
      WHERE (state = 'PENDING' AND available_at <= ${now})
         OR (state = 'IN_FLIGHT' AND leased_until < ${now})
      ORDER BY created_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `;

  const result: DrainResult = { claimed: claimed.length, confirmed: 0, failed: 0, errors: [] };

  for (const { id } of claimed) {
    const entry = await ctx.prisma.outboxEntry.findUnique({ where: { id } });
    if (!entry) continue;

    try {
      const outcome = await dispatch(ctx, writer, entry.kind as OutboxKind, entry.payload);

      if (outcome === SUPERSEDED) {
        // A later version of the same list already landed. Re-sending this one
        // would be asking the chain to roll back, which StatusRegistry rightly
        // refuses — so it is closed out, not retried to exhaustion.
        await ctx.prisma.outboxEntry.update({
          where: { id },
          data: {
            state: 'CONFIRMED',
            leasedUntil: null,
            attempts: { increment: 1 },
            lastError: 'superseded by a newer version already on chain',
          },
        });
        result.confirmed += 1;
        continue;
      }

      await ctx.prisma.outboxEntry.update({
        where: { id },
        data: {
          state: 'CONFIRMED',
          txHash: outcome,
          leasedUntil: null,
          attempts: { increment: 1 },
        },
      });
      result.confirmed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempts = entry.attempts + 1;
      const exhausted = attempts >= maxAttempts;

      await ctx.prisma.outboxEntry.update({
        where: { id },
        data: {
          state: exhausted ? 'FAILED' : 'PENDING',
          attempts,
          lastError: message.slice(0, 500),
          leasedUntil: null,
          availableAt: new Date(
            (ctx.now() +
              (BACKOFF_SECONDS[Math.min(attempts - 1, BACKOFF_SECONDS.length - 1)] ?? 1800)) *
              1000,
          ),
        },
      });

      if (exhausted) {
        // A batch whose anchor will never land must not sit reading ANCHORING
        // forever; an operator has to be able to see it and act.
        await markBatchFailed(ctx, entry.kind, entry.payload, message);
      }

      result.failed += 1;
      result.errors.push({ id, kind: entry.kind, message });
    }
  }

  return result;
}

async function dispatch(
  ctx: AppContext,
  writer: LedgerWriter,
  kind: OutboxKind,
  rawPayload: unknown,
): Promise<string | typeof SUPERSEDED> {
  const payload = rawPayload as Record<string, unknown>;

  switch (kind) {
    case 'ANCHOR_BATCH': {
      const tx = await writer.anchorBatch({
        orgId: payload['orgId'] as Hex,
        merkleRoot: payload['merkleRoot'] as Hex,
        leafCount: Number(payload['leafCount']),
        manifestUri: String(payload['manifestUri']),
      });
      await ctx.prisma.batch.update({
        where: { id: String(payload['batchId']) },
        data: {
          state: 'PUBLISHED',
          txHash: tx.txHash,
          anchoredAt: new Date(ctx.now() * 1000),
        },
      });
      return tx.txHash;
    }

    case 'PUBLISH_STATUS_LIST': {
      const orgId = payload['orgId'] as Hex;
      const listId = Number(payload['listId']);
      const version = Number(payload['version']);

      // Status list publishes supersede one another. Revocations queue faster
      // than blocks confirm, so by the time an entry is drained the chain may
      // already hold a strictly newer list, which includes every bit this one
      // carried. Sending it anyway is a guaranteed revert.
      const onChain = await ctx.ledger.getStatusList(orgId, listId);
      if (onChain && onChain.version >= version) return SUPERSEDED;

      const tx = await writer.publishStatusList({
        orgId,
        listId,
        listHash: payload['listHash'] as Hex,
        uri: String(payload['uri']),
        version,
      });
      return tx.txHash;
    }

    case 'ANCHOR_AUDIT': {
      // Anchoring a period twice is refused by the contract; that revert is a
      // genuine error worth surfacing, so it is not special-cased here.
      const tx = await writer.anchorAudit({
        periodStart: Number(payload['periodStart']),
        merkleRoot: payload['merkleRoot'] as Hex,
        leafCount: Number(payload['leafCount']),
      });
      return tx.txHash;
    }

    case 'CHECKPOINT': {
      const tx = await writer.checkpoint({
        stateRoot: payload['stateRoot'] as Hex,
        blockNumber: Number(payload['blockNumber']),
      });
      return tx.txHash;
    }

    default: {
      const exhaustive: never = kind;
      throw new Error(`unknown outbox kind ${String(exhaustive)}`);
    }
  }
}

async function markBatchFailed(
  ctx: AppContext,
  kind: string,
  rawPayload: unknown,
  message: string,
): Promise<void> {
  if (kind !== 'ANCHOR_BATCH') return;
  const batchId = (rawPayload as { batchId?: string }).batchId;
  if (!batchId) return;

  await ctx.prisma.batch
    .update({
      where: { id: batchId },
      data: { state: 'FAILED', failureReason: message.slice(0, 500) },
    })
    .catch(() => undefined);
}

/** Outbox depth, for the operator dashboard and alerting. */
export async function outboxHealth(ctx: AppContext): Promise<{
  pending: number;
  inFlight: number;
  failed: number;
  oldestPendingSeconds: number | null;
}> {
  const [pending, inFlight, failed, oldest] = await Promise.all([
    ctx.prisma.outboxEntry.count({ where: { state: 'PENDING' } }),
    ctx.prisma.outboxEntry.count({ where: { state: 'IN_FLIGHT' } }),
    ctx.prisma.outboxEntry.count({ where: { state: 'FAILED' } }),
    ctx.prisma.outboxEntry.findFirst({
      where: { state: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ]);

  return {
    pending,
    inFlight,
    failed,
    oldestPendingSeconds: oldest
      ? Math.max(0, ctx.now() - Math.floor(oldest.createdAt.getTime() / 1000))
      : null,
  };
}
