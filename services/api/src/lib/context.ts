/**
 * The application context: everything a route handler needs, assembled once.
 *
 * Passing this explicitly rather than reaching for module-level singletons is
 * what makes the API testable against a real database and a real chain without
 * a process-wide mutable state to reset between tests.
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createLedgerPublicClient,
  LedgerReader,
  parseContractAddresses,
  type ContractAddresses,
} from '@civiledger/chain';
import { createMemoryVersionFloor, type VersionFloor } from '@civiledger/status-list';
import type { AppConfig } from './config.js';
import { LocalDevSignerProvider, type SignerProvider } from '../services/signer-provider.js';

export interface AppContext {
  config: AppConfig;
  prisma: PrismaClient;
  ledger: LedgerReader;
  addresses: ContractAddresses;
  signers: SignerProvider;
  /**
   * Rollback floor for status lists, shared across requests.
   *
   * In-memory here. A multi-instance deployment must back this with Redis or
   * Postgres, or one instance can be served a rolled-back list that another
   * instance would have caught.
   */
  versionFloor: VersionFloor;
  /** Injectable so tests can pin time. Seconds since epoch. */
  now(): number;
}

export interface BuildContextOptions {
  config: AppConfig;
  prisma?: PrismaClient;
  signers?: SignerProvider;
  now?: () => number;
}

export function loadAddresses(config: AppConfig): ContractAddresses {
  const path =
    config.DEPLOYMENTS_FILE ??
    resolve(process.cwd(), `../../contracts/deployments/${config.CHAIN_ID}.json`);
  try {
    return parseContractAddresses(JSON.parse(readFileSync(path, 'utf8')));
  } catch (error) {
    throw new Error(
      `could not load contract addresses from ${path} — run the deploy script first ` +
        `(${error instanceof Error ? error.message : 'unknown error'})`,
    );
  }
}

export function buildContext(options: BuildContextOptions): AppContext {
  const { config } = options;
  const prisma = options.prisma ?? new PrismaClient({ datasourceUrl: config.DATABASE_URL });

  const addresses = loadAddresses(config);
  const publicClient = createLedgerPublicClient({
    rpcUrl: config.CHAIN_RPC_URL,
    chainId: config.CHAIN_ID,
    ...(config.CHAIN_EXPLORER_URL ? { explorerBaseUrl: config.CHAIN_EXPLORER_URL } : {}),
  });

  const signers =
    options.signers ??
    new LocalDevSignerProvider(prisma, config.keyRing, {
      isProduction: config.isProduction,
      allowRealPersonalData: config.ALLOW_REAL_PERSONAL_DATA,
    });

  return {
    config,
    prisma,
    addresses,
    ledger: new LedgerReader(publicClient, addresses),
    signers,
    versionFloor: createMemoryVersionFloor(),
    now: options.now ?? (() => Math.floor(Date.now() / 1000)),
  };
}
