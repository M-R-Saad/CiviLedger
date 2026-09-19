/**
 * The anchor worker.
 *
 * A single long-running process with a simple tick loop rather than a job
 * queue: the whole workload is "drain a table, then do four things on a
 * schedule", and every job is idempotent, so a crash costs one tick.
 *
 * This process holds the only key that can write to the ledger. It is
 * deliberately not the API — an API compromise must not be able to anchor
 * anything, and this process exposes no inbound surface at all.
 */

import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import {
  accountFromPrivateKey,
  createLedgerPublicClient,
  createLedgerWalletClient,
  LedgerWriter,
} from '@civiledger/chain';
import { loadConfig } from '@civiledger/api/lib/config.js';
import { buildContext, type AppContext } from '@civiledger/api/lib/context.js';
import { drainOutbox, outboxHealth } from '@civiledger/api/services/outbox.service.js';
import {
  anchorAuditPeriod,
  dhakaDayStart,
  expireReceipts,
  recordCheckpoint,
  sweepExpired,
} from './jobs.js';

const TICK_SECONDS = Number(process.env['WORKER_TICK_SECONDS'] ?? 15);
const DAILY_JOB_HOUR_DHAKA = Number(process.env['WORKER_DAILY_HOUR'] ?? 2);

const log = pino({ level: process.env['LOG_LEVEL'] ?? 'info', name: 'anchor-worker' });

let stopping = false;
let lastDailyRun = 0;

async function main(): Promise<void> {
  const config = loadConfig();
  const prisma = new PrismaClient({ datasourceUrl: config.DATABASE_URL });
  const ctx = buildContext({ config, prisma });

  const privateKey = process.env['ANCHOR_PRIVATE_KEY'];
  if (!privateKey) {
    throw new Error(
      'ANCHOR_PRIVATE_KEY is required. This key anchors registry writes only — it is ' +
        'not an issuer signing key and cannot produce a credential (invariant §25).',
    );
  }

  const account = accountFromPrivateKey(privateKey);
  const chainConfig = { rpcUrl: config.CHAIN_RPC_URL, chainId: config.CHAIN_ID };
  const publicClient = createLedgerPublicClient(chainConfig);
  const wallet = createLedgerWalletClient(chainConfig, account);
  const writer = new LedgerWriter(publicClient, wallet, ctx.addresses);

  log.info(
    { account: account.address, chainId: config.CHAIN_ID, tickSeconds: TICK_SECONDS },
    'anchor worker started',
  );

  process.on('SIGTERM', () => {
    stopping = true;
  });
  process.on('SIGINT', () => {
    stopping = true;
  });

  while (!stopping) {
    try {
      await tick(ctx, writer);
    } catch (error) {
      // A tick must never take the worker down: the next one retries, and the
      // outbox is the durable record of what still needs doing.
      log.error({ err: error }, 'tick failed');
    }
    await sleep(TICK_SECONDS * 1000);
  }

  log.info('shutting down');
  await prisma.$disconnect();
  process.exit(0);
}

async function tick(ctx: AppContext, writer: LedgerWriter): Promise<void> {
  const drained = await drainOutbox(ctx, writer, { limit: 25 });
  if (drained.claimed > 0) {
    log.info(
      { claimed: drained.claimed, confirmed: drained.confirmed, failed: drained.failed },
      'outbox drained',
    );
    for (const error of drained.errors) {
      log.warn({ id: error.id, kind: error.kind, message: error.message }, 'outbox entry failed');
    }
  }

  const health = await outboxHealth(ctx);
  if (health.failed > 0 || (health.oldestPendingSeconds ?? 0) > 900) {
    // Anchoring falling behind is not visible to users — a credential still
    // verifies, with its status list flagged as pending — so it has to be
    // visible to an operator instead.
    log.warn(health, 'outbox is falling behind');
  }

  await runDailyJobs(ctx, writer);
}

async function runDailyJobs(ctx: AppContext, writer: LedgerWriter): Promise<void> {
  const now = ctx.now();
  const todayStart = dhakaDayStart(now);
  const dueAt = todayStart + DAILY_JOB_HOUR_DHAKA * 3600;

  if (now < dueAt || lastDailyRun >= todayStart) return;
  lastDailyRun = todayStart;

  const yesterday = todayStart - 86_400;

  const audit = await anchorAuditPeriod(ctx, writer, yesterday);
  log.info(audit, 'consent receipt root');

  const checkpoint = await recordCheckpoint(ctx, writer);
  if (checkpoint.status === 'recorded') log.info(checkpoint, 'public checkpoint recorded');

  const expired = await expireReceipts(ctx);
  if (expired.deleted > 0) log.info(expired, 'consent receipts past retention deleted');

  const swept = await sweepExpired(ctx);
  if (swept.sessions > 0 || swept.shareLinks > 0) log.info(swept, 'expired records swept');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error: unknown) => {
  log.fatal({ err: error }, 'anchor worker failed to start');
  process.exit(1);
});
