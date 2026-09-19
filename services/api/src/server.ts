/**
 * API entrypoint.
 *
 * Fails fast and loudly: configuration, the database, the contract address book
 * and the chain are all checked before the listener opens. A server that boots
 * and then 500s on the first verification is worse than one that never came up.
 */

import { PrismaClient } from '@prisma/client';
import { buildApp } from './app.js';
import { loadConfig } from './lib/config.js';
import { buildContext } from './lib/context.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const prisma = new PrismaClient({ datasourceUrl: config.DATABASE_URL });
  const ctx = buildContext({ config, prisma });

  await prisma.$queryRaw`SELECT 1`;
  const blockNumber = await ctx.ledger.blockNumber();

  const app = await buildApp(ctx);

  app.log.info(
    {
      chainId: config.CHAIN_ID,
      blockNumber,
      issuerRegistry: ctx.addresses.IssuerRegistry,
      signerProvider: ctx.signers.kind,
      realPersonalData: config.ALLOW_REAL_PERSONAL_DATA,
    },
    'ledger connected',
  );

  if (ctx.signers.kind === 'local-dev') {
    app.log.warn(
      'using the local development signer — issuer keys are held by this process. ' +
        'This is only valid for synthetic data (PLAN §12.1, invariant §25).',
    );
  }

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    // Close the listener first so in-flight requests finish before the pool
    // goes away — a verification cut off mid-transaction would leave a
    // consent receipt without its verification.
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: config.PORT, host: config.HOST });
}

main().catch((error: unknown) => {
  console.error('failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
