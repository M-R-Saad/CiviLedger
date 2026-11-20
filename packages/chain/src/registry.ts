/**
 * Reading the ledger. PLAN.html §5.3 steps 1, 4 and 5.
 *
 * Everything here is a view call. Writes live in anchor.ts and are available
 * only to the anchor worker.
 */

import { keccak256, stringToHex, type Address, type Hex } from 'viem';
import { anchorRegistryAbi, issuerRegistryAbi, statusRegistryAbi, auditAnchorAbi } from './abis.js';
import type { ContractAddresses, LedgerPublicClient } from './client.js';

/**
 * The on-chain identifier for an organisation.
 *
 * A keccak of a stable institutional slug — `uiu`, `bmdc` — not of anything
 * about a person. Deterministic so the same institution has the same orgId on
 * the devnet, the pilot chain and production.
 */
export function orgIdOf(slug: string): Hex {
  const normalised = slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(normalised)) {
    throw new Error(`"${slug}" is not a valid organisation slug`);
  }
  return keccak256(stringToHex(`civiledger.org.${normalised}`));
}

export const ACCREDITATION = [
  'SELF_ASSERTED',
  'PROFESSIONAL_BODY',
  'BOARD',
  'UGC_RECOGNIZED',
] as const;
export type Accreditation = (typeof ACCREDITATION)[number];

export const ISSUER_STATUS = ['PENDING', 'ACTIVE', 'SUSPENDED', 'RETIRED'] as const;
export type IssuerStatus = (typeof ISSUER_STATUS)[number];

export interface IssuerRecord {
  orgId: Hex;
  didWeb: string;
  accreditation: Accreditation;
  status: IssuerStatus;
  exists: boolean;
}

export interface KeyEpochRecord {
  epoch: number;
  jwkThumbprint: Hex;
  validFrom: number;
  /** 0 while current. */
  validUntil: number;
  revocationReason: Hex;
}

export interface KeyAtResult {
  thumbprint: Hex;
  valid: boolean;
  /** Decoded bytes32 reason, or undefined when the epoch was not revoked. */
  reason?: string;
}

export interface StatusListRecord {
  listHash: Hex;
  uri: string;
  version: number;
  updatedAt: number;
}

export interface BatchRecord {
  orgId: Hex;
  merkleRoot: Hex;
  leafCount: number;
  anchoredAt: number;
  manifestUri: string;
}

const ZERO32 = `0x${'0'.repeat(64)}` as const;

/** Decode a bytes32 reason code back into its ASCII form. */
export function decodeReason(reason: Hex): string | undefined {
  if (reason === ZERO32) return undefined;
  const bytes = Buffer.from(reason.slice(2), 'hex');
  const end = bytes.indexOf(0);
  const text = bytes.subarray(0, end === -1 ? bytes.length : end).toString('utf8');
  return text.length > 0 ? text : reason;
}

export class LedgerReader {
  constructor(
    private readonly client: LedgerPublicClient,
    private readonly addresses: ContractAddresses,
  ) {}

  /**
   * Resolve the key that was in force when a credential was signed.
   *
   * Takes a signing timestamp, never "now" — a rotation must not invalidate
   * history (invariant §25).
   */
  async keyAt(orgId: Hex, signedAtSeconds: number): Promise<KeyAtResult> {
    const [thumbprint, valid, reason] = await this.client.readContract({
      address: this.addresses.IssuerRegistry,
      abi: issuerRegistryAbi,
      functionName: 'keyAt',
      args: [orgId, BigInt(Math.floor(signedAtSeconds))],
    });
    const decoded = decodeReason(reason);
    return { thumbprint, valid, ...(decoded === undefined ? {} : { reason: decoded }) };
  }

  async getIssuer(orgId: Hex): Promise<IssuerRecord> {
    const issuer = await this.client.readContract({
      address: this.addresses.IssuerRegistry,
      abi: issuerRegistryAbi,
      functionName: 'getIssuer',
      args: [orgId],
    });
    return {
      orgId,
      didWeb: issuer.didWeb,
      accreditation: ACCREDITATION[issuer.accreditation] ?? 'SELF_ASSERTED',
      status: ISSUER_STATUS[issuer.status] ?? 'PENDING',
      exists: issuer.exists,
    };
  }

  async getEpochs(orgId: Hex): Promise<KeyEpochRecord[]> {
    const epochs = await this.client.readContract({
      address: this.addresses.IssuerRegistry,
      abi: issuerRegistryAbi,
      functionName: 'getEpochs',
      args: [orgId],
    });
    return epochs.map((e, index) => ({
      epoch: index,
      jwkThumbprint: e.jwkThumbprint,
      validFrom: Number(e.validFrom),
      validUntil: Number(e.validUntil),
      revocationReason: e.revocationReason,
    }));
  }

  async orgIds(): Promise<readonly Hex[]> {
    return this.client.readContract({
      address: this.addresses.IssuerRegistry,
      abi: issuerRegistryAbi,
      functionName: 'orgIds',
    });
  }

  async isOperator(orgId: Hex, operator: Address): Promise<boolean> {
    return this.client.readContract({
      address: this.addresses.IssuerRegistry,
      abi: issuerRegistryAbi,
      functionName: 'isOperator',
      args: [orgId, operator],
    });
  }

  /** Returns undefined when the list has never been published. */
  async getStatusList(orgId: Hex, listId: number): Promise<StatusListRecord | undefined> {
    const published = await this.client.readContract({
      address: this.addresses.StatusRegistry,
      abi: statusRegistryAbi,
      functionName: 'exists',
      args: [orgId, listId],
    });
    if (!published) return undefined;

    const [listHash, uri, version, updatedAt] = await this.client.readContract({
      address: this.addresses.StatusRegistry,
      abi: statusRegistryAbi,
      functionName: 'getStatusList',
      args: [orgId, listId],
    });
    return { listHash, uri, version: Number(version), updatedAt: Number(updatedAt) };
  }

  async getBatch(batchId: Hex): Promise<BatchRecord | undefined> {
    const present = await this.client.readContract({
      address: this.addresses.AnchorRegistry,
      abi: anchorRegistryAbi,
      functionName: 'exists',
      args: [batchId],
    });
    if (!present) return undefined;

    const [orgId, merkleRoot, leafCount, anchoredAt, manifestUri] = await this.client.readContract({
      address: this.addresses.AnchorRegistry,
      abi: anchorRegistryAbi,
      functionName: 'getBatch',
      args: [batchId],
    });
    return {
      orgId,
      merkleRoot,
      leafCount: Number(leafCount),
      anchoredAt: Number(anchoredAt),
      manifestUri,
    };
  }

  async verifyInclusion(batchId: Hex, leaf: Hex, proof: readonly Hex[]): Promise<boolean> {
    return this.client.readContract({
      address: this.addresses.AnchorRegistry,
      abi: anchorRegistryAbi,
      functionName: 'verifyInclusion',
      args: [batchId, leaf, proof],
    });
  }

  async latestCheckpoint(): Promise<
    { stateRoot: Hex; blockNumber: number; recordedAt: number } | undefined
  > {
    const count = await this.client.readContract({
      address: this.addresses.AuditAnchor,
      abi: auditAnchorAbi,
      functionName: 'checkpointCount',
    });
    if (count === 0n) return undefined;

    const checkpoint = await this.client.readContract({
      address: this.addresses.AuditAnchor,
      abi: auditAnchorAbi,
      functionName: 'latestCheckpoint',
    });
    return {
      stateRoot: checkpoint.stateRoot,
      blockNumber: Number(checkpoint.blockNumber),
      recordedAt: Number(checkpoint.recordedAt),
    };
  }

  async blockNumber(): Promise<number> {
    return Number(await this.client.getBlockNumber());
  }
}
