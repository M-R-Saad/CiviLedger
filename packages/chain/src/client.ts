/**
 * viem clients for the consortium ledger. PLAN.html §7.1.
 *
 * Two clients, deliberately separate:
 *   - a public (read) client, which everything uses, and
 *   - an optional wallet (write) client, which only the anchor worker holds.
 *
 * The API server is configured without a write client. It cannot send a
 * transaction even if a code path tries to, which keeps the blast radius of an
 * API compromise to off-chain data.
 */

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Account,
  type Address,
  type Chain,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export interface ChainConfig {
  rpcUrl: string;
  chainId: number;
  /** Human name for logs and the block-explorer link in the UI. */
  name?: string;
  explorerBaseUrl?: string;
}

export interface ContractAddresses {
  Governance: Address;
  IssuerRegistry: Address;
  StatusRegistry: Address;
  AnchorRegistry: Address;
  AuditAnchor: Address;
}

export const CONTRACT_NAMES = [
  'Governance',
  'IssuerRegistry',
  'StatusRegistry',
  'AnchorRegistry',
  'AuditAnchor',
] as const;

export class ChainConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChainConfigError';
  }
}

/**
 * Besu with IBFT 2.0 has deterministic finality: a block is final when it is
 * sealed, so one confirmation is the truth rather than a probabilistic guess.
 */
export function defineLedgerChain(config: ChainConfig): Chain {
  return defineChain({
    id: config.chainId,
    name: config.name ?? `civiledger-${config.chainId}`,
    nativeCurrency: { name: 'Gas', symbol: 'GAS', decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
    ...(config.explorerBaseUrl
      ? { blockExplorers: { default: { name: 'Explorer', url: config.explorerBaseUrl } } }
      : {}),
  });
}

export type LedgerPublicClient = PublicClient;

export function createLedgerPublicClient(config: ChainConfig): LedgerPublicClient {
  return createPublicClient({
    chain: defineLedgerChain(config),
    transport: http(config.rpcUrl, {
      // A registry read that hangs must not hold an HTTP request open; the
      // verification path has a two-second promise to keep (PLAN §5.1).
      timeout: 5_000,
      retryCount: 2,
      retryDelay: 150,
    }),
  }) as LedgerPublicClient;
}

export function createLedgerWalletClient(config: ChainConfig, account: Account): WalletClient {
  return createWalletClient({
    account,
    chain: defineLedgerChain(config),
    transport: http(config.rpcUrl, { timeout: 15_000, retryCount: 1 }),
  });
}

/**
 * Load the anchor worker's account from a private key.
 *
 * This key signs registry *anchoring* transactions only. It is not an issuer
 * signing key and can never produce a credential — issuer keys are
 * non-exportable and live in a KMS (invariant §25). Confusing the two is the
 * single most dangerous mistake available in this codebase.
 */
export function accountFromPrivateKey(privateKey: string): Account {
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new ChainConfigError('anchor key must be a 0x-prefixed 32-byte hex string');
  }
  return privateKeyToAccount(privateKey as `0x${string}`);
}

/** Validate an address book loaded from the deploy script's JSON output. */
export function parseContractAddresses(raw: unknown): ContractAddresses {
  if (typeof raw !== 'object' || raw === null) {
    throw new ChainConfigError('deployment address book is not an object');
  }
  const source = raw as Record<string, unknown>;
  const out: Partial<ContractAddresses> = {};

  for (const name of CONTRACT_NAMES) {
    const value = source[name];
    if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
      throw new ChainConfigError(`deployment is missing a valid address for ${name}`);
    }
    out[name] = value as Address;
  }
  return out as ContractAddresses;
}
