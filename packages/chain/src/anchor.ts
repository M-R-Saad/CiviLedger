/**
 * Ledger writes. Only the anchor worker constructs this.
 *
 * Every method waits for one confirmation. Besu with IBFT 2.0 gives
 * deterministic finality, so one sealed block is final rather than a
 * probabilistic guess — there is no reorg to wait out.
 */

import {
  encodeFunctionData,
  stringToHex,
  pad,
  type Address,
  type Hash,
  type Hex,
  type WalletClient,
} from 'viem';
import {
  anchorRegistryAbi,
  auditAnchorAbi,
  governanceAbi,
  issuerRegistryAbi,
  statusRegistryAbi,
} from './abis.js';
import type { ContractAddresses, LedgerPublicClient } from './client.js';

export interface TxResult {
  txHash: Hash;
  blockNumber: number;
  gasUsed: bigint;
}

/** Encode a short reason code as bytes32. Reason codes are never free text. */
export function reasonCode(code: string): Hex {
  if (!/^[A-Z][A-Z0-9_]{0,30}$/.test(code)) {
    throw new Error(
      `"${code}" is not a reason code — use SCREAMING_SNAKE_CASE, max 31 chars, and never free text (PLAN §11)`,
    );
  }
  return pad(stringToHex(code), { size: 32, dir: 'right' });
}

export class LedgerWriter {
  constructor(
    private readonly publicClient: LedgerPublicClient,
    private readonly wallet: WalletClient,
    private readonly addresses: ContractAddresses,
  ) {}

  get account(): Address {
    const account = this.wallet.account;
    if (!account) throw new Error('wallet client has no account');
    return account.address;
  }

  /** Anchor a batch of credential leaves. Idempotent: the same batch reverts. */
  async anchorBatch(args: {
    orgId: Hex;
    merkleRoot: Hex;
    leafCount: number;
    manifestUri: string;
  }): Promise<TxResult> {
    return this.send(this.addresses.AnchorRegistry, anchorRegistryAbi, 'anchorBatch', [
      args.orgId,
      args.merkleRoot,
      args.leafCount,
      args.manifestUri,
    ]);
  }

  /** Publish a status list hash. Reverts unless `version` strictly increases. */
  async publishStatusList(args: {
    orgId: Hex;
    listId: number;
    listHash: Hex;
    uri: string;
    version: number;
  }): Promise<TxResult> {
    return this.send(this.addresses.StatusRegistry, statusRegistryAbi, 'publishStatusList', [
      args.orgId,
      args.listId,
      args.listHash,
      args.uri,
      BigInt(args.version),
    ]);
  }

  /** Anchor one day's consent-receipt Merkle root. */
  async anchorAudit(args: {
    periodStart: number;
    merkleRoot: Hex;
    leafCount: number;
  }): Promise<TxResult> {
    return this.send(this.addresses.AuditAnchor, auditAnchorAbi, 'anchorAudit', [
      BigInt(args.periodStart),
      args.merkleRoot,
      args.leafCount,
    ]);
  }

  /** Record the chain's state root for weekly mirroring to a public network. */
  async checkpoint(args: { stateRoot: Hex; blockNumber: number }): Promise<TxResult> {
    return this.send(this.addresses.AuditAnchor, auditAnchorAbi, 'checkpoint', [
      args.stateRoot,
      BigInt(args.blockNumber),
    ]);
  }

  /**
   * Propose a governed action. Returns the action id so a second organisation
   * can approve it out of band — this client never approves and executes in one
   * breath, because that would make M-of-N theatre.
   */
  async proposeGovernedAction(target: Address, payload: Hex): Promise<TxResult> {
    return this.send(this.addresses.Governance, governanceAbi, 'proposeAction', [target, payload]);
  }

  /** Encode an IssuerRegistry call for submission through Governance. */
  encodeIssuerRegistryCall(
    functionName:
      | 'registerIssuer'
      | 'rotateKey'
      | 'revokeKey'
      | 'setStatus'
      | 'setAccreditation'
      | 'setOperator'
      | 'setDidWeb',
    args: readonly unknown[],
  ): { target: Address; payload: Hex } {
    return {
      target: this.addresses.IssuerRegistry,
      payload: encodeFunctionData({
        abi: issuerRegistryAbi,
        functionName,
        args: args as never,
      }),
    };
  }

  private async send(
    address: Address,
    abi: readonly unknown[],
    functionName: string,
    args: readonly unknown[],
  ): Promise<TxResult> {
    const account = this.wallet.account;
    if (!account) throw new Error('wallet client has no account');

    // Simulate first: a revert becomes a typed error here rather than a wasted
    // transaction and a silent failure the operator finds out about days later.
    const { request } = await this.publicClient.simulateContract({
      account,
      address,
      abi: abi as never,
      functionName,
      args: args as never,
      chain: this.wallet.chain,
    });

    const txHash = await this.wallet.writeContract(request as never);
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
      timeout: 60_000,
    });
    if (receipt.status !== 'success') {
      throw new Error(`transaction ${txHash} reverted`);
    }
    return { txHash, blockNumber: Number(receipt.blockNumber), gasUsed: receipt.gasUsed };
  }
}
