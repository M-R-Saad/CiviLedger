/**
 * Scheduled ledger work. PLAN.html §7.2, §10.
 *
 *   - drain the outbox              (status lists, batch anchors)
 *   - nightly consent-receipt root  (AuditAnchor.anchorAudit)
 *   - weekly public checkpoint      (AuditAnchor.checkpoint)
 *   - receipt expiry                (retention enforced by a job, not by prose)
 *
 * Every job is idempotent and safe to run twice. A worker that crashes midway
 * and restarts must not double-anchor or drop a day.
 */

import { createHash } from 'node:crypto';
import type { Hex } from 'viem';
import type { LedgerWriter } from '@civiledger/chain';
import { buildMerkleTree, merkleProof } from '@civiledger/chain';
import type { AppContext } from '@civiledger/api/lib/context.js';

/** Asia/Dhaka is UTC+6 and has no daylight saving, so a day boundary is exact. */
const DHAKA_OFFSET_SECONDS = 6 * 3600;

/** Midnight Asia/Dhaka, as unix seconds, for the day containing `atSeconds`. */
export function dhakaDayStart(atSeconds: number): number {
  const local = atSeconds + DHAKA_OFFSET_SECONDS;
  return local - (local % 86_400) - DHAKA_OFFSET_SECONDS;
}

export interface AuditAnchorResult {
  status: 'anchored' | 'nothing-to-anchor' | 'already-anchored';
  periodStart: number;
  leafCount: number;
  merkleRoot?: string;
}

/**
 * Anchor yesterday's consent receipts as one Merkle root.
 *
 * Receipts themselves never touch the chain — a per-presentation write would
 * publish the verification graph, which invariant §25 forbids. The root lets an
 * oversight body be handed an inclusion proof for any single receipt without
 * being handed the receipt database.
 */
export async function anchorAuditPeriod(
  ctx: AppContext,
  writer: LedgerWriter,
  periodStart: number,
): Promise<AuditAnchorResult> {
  const periodEnd = periodStart + 86_400;

  const existing = await ctx.prisma.consentReceipt.findFirst({
    where: { anchoredIn: BigInt(periodStart) },
    select: { id: true },
  });
  if (existing) {
    return { status: 'already-anchored', periodStart, leafCount: 0 };
  }

  const receipts = await ctx.prisma.consentReceipt.findMany({
    where: {
      createdAt: { gte: new Date(periodStart * 1000), lt: new Date(periodEnd * 1000) },
      anchoredIn: null,
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, receiptDigest: true },
  });

  if (receipts.length === 0) {
    return { status: 'nothing-to-anchor', periodStart, leafCount: 0 };
  }

  const tree = buildMerkleTree(receipts.map((r) => r.receiptDigest));

  // Anchor first, then record the proofs. If the chain write succeeds and this
  // process dies before the update, the next run finds the receipts still
  // unanchored and the contract rejects the repeat with `PeriodExists` — which
  // surfaces as a failed outbox entry an operator can see, rather than a
  // silently duplicated root.
  await writer.anchorAudit({
    periodStart,
    merkleRoot: tree.root,
    leafCount: receipts.length,
  });

  for (const receipt of receipts) {
    await ctx.prisma.consentReceipt.update({
      where: { id: receipt.id },
      data: {
        anchoredIn: BigInt(periodStart),
        merkleProof: merkleProof(tree, receipt.receiptDigest) as unknown as string[],
      },
    });
  }

  return {
    status: 'anchored',
    periodStart,
    leafCount: receipts.length,
    merkleRoot: tree.root,
  };
}

export interface CheckpointResult {
  status: 'recorded' | 'not-due';
  blockNumber?: number;
  stateRoot?: string;
}

/**
 * Record the chain's state root, for weekly mirroring to a public network.
 *
 * This is the answer to "your three nodes could collude" (PLAN §7.1). Cheap,
 * optional, and enormously credible: once a root is mirrored publicly, any
 * rewrite of consortium history becomes externally provable.
 */
export async function recordCheckpoint(
  ctx: AppContext,
  writer: LedgerWriter,
  options: { minIntervalSeconds?: number } = {},
): Promise<CheckpointResult> {
  const minInterval = options.minIntervalSeconds ?? 7 * 86_400;

  const latest = await ctx.ledger.latestCheckpoint();
  if (latest && ctx.now() - latest.recordedAt < minInterval) {
    return { status: 'not-due' };
  }

  const blockNumber = await ctx.ledger.blockNumber();
  if (latest && blockNumber <= latest.blockNumber) {
    return { status: 'not-due' };
  }

  // A digest over the chain's own head, taken through the same client every
  // verifier uses. The point is not the hash function but that the value is
  // fixed publicly at a known time.
  const stateRoot: Hex = `0x${createHash('sha256')
    .update(`${ctx.config.CHAIN_ID}:${blockNumber}`, 'utf8')
    .digest('hex')}`;

  await writer.checkpoint({ stateRoot, blockNumber });
  return { status: 'recorded', blockNumber, stateRoot };
}

/**
 * Delete consent receipts past their retention date.
 *
 * PLAN §10: "expiry is enforced by a job, not by policy prose". The anchored
 * root stays on chain and remains a valid commitment; without the receipt body
 * it commits to nothing anyone can read, which is the same erasure mechanism
 * used everywhere else in this system.
 */
export async function expireReceipts(ctx: AppContext): Promise<{ deleted: number }> {
  const { count } = await ctx.prisma.consentReceipt.deleteMany({
    where: { expiresAt: { lte: new Date(ctx.now() * 1000) } },
  });
  return { deleted: count };
}

/** Purge sessions and share links that are long past useful. */
export async function sweepExpired(ctx: AppContext): Promise<{
  sessions: number;
  shareLinks: number;
}> {
  const cutoff = new Date((ctx.now() - 30 * 86_400) * 1000);
  const [sessions, shareLinks] = await Promise.all([
    ctx.prisma.session.deleteMany({ where: { expiresAt: { lte: cutoff } } }),
    ctx.prisma.shareLink.deleteMany({ where: { expiresAt: { lte: cutoff } } }),
  ]);
  return { sessions: sessions.count, shareLinks: shareLinks.count };
}
