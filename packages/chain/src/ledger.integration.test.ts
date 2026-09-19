/**
 * Integration tests against a real EVM node.
 *
 * Skipped unless CIVILEDGER_TEST_RPC_URL is set, so `pnpm test` stays fast and
 * hermetic. Run them with:
 *
 *   anvil --port 8545 --chain-id 1337 &
 *   forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 \
 *     --broadcast --sig "run(address,bytes32)" $ADMIN $ORG --private-key $KEY
 *   CIVILEDGER_TEST_RPC_URL=http://127.0.0.1:8545 pnpm --filter @civiledger/chain test
 *
 * The point of these is the one thing unit tests cannot cover: that the Merkle
 * tree this package builds in JavaScript and the proof AnchorRegistry verifies
 * in Solidity are the same tree. A disagreement there would let every anchor
 * proof fail in production while every unit test stayed green.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { encodeFunctionData, keccak256, stringToHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createLedgerPublicClient,
  createLedgerWalletClient,
  parseContractAddresses,
  type ContractAddresses,
} from './client.js';
import { governanceAbi, issuerRegistryAbi } from './abis.js';
import { LedgerReader, orgIdOf } from './registry.js';
import { LedgerWriter, reasonCode } from './anchor.js';
import { anchorLeaf, buildMerkleTree, merkleProof } from './merkle.js';

const RPC_URL = process.env['CIVILEDGER_TEST_RPC_URL'];
const CHAIN_ID = Number(process.env['CIVILEDGER_TEST_CHAIN_ID'] ?? 1337);
/** Anvil's first account. A well-known test key — never used anywhere real. */
const DEPLOYER_KEY = (process.env['CIVILEDGER_TEST_KEY'] ??
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as Hex;

const suite = RPC_URL ? describe : describe.skip;

suite('ledger integration', () => {
  let addresses: ContractAddresses;
  let reader: LedgerReader;
  let writer: LedgerWriter;
  let orgId: Hex;
  const account = privateKeyToAccount(DEPLOYER_KEY);

  beforeAll(async () => {
    const deploymentPath = resolve(
      import.meta.dirname,
      `../../../contracts/deployments/${CHAIN_ID}.json`,
    );
    addresses = parseContractAddresses(JSON.parse(readFileSync(deploymentPath, 'utf8')));

    const config = { rpcUrl: RPC_URL!, chainId: CHAIN_ID };
    const publicClient = createLedgerPublicClient(config);
    const wallet = createLedgerWalletClient(config, account);
    reader = new LedgerReader(publicClient, addresses);
    writer = new LedgerWriter(publicClient, wallet, addresses);

    // Each run uses a fresh orgId so the suite is re-runnable against a chain
    // that already has state.
    orgId = orgIdOf(`test-${Date.now().toString(36)}`);

    await govern(
      addresses.IssuerRegistry,
      encodeFunctionData({
        abi: issuerRegistryAbi,
        functionName: 'registerIssuer',
        args: [orgId, 'did:web:test.civiledger.com.bd', 3, keccak256(stringToHex('key-1')), 0n],
      }),
    );
    await govern(
      addresses.IssuerRegistry,
      encodeFunctionData({
        abi: issuerRegistryAbi,
        functionName: 'setOperator',
        args: [orgId, account.address, true],
      }),
    );
  }, 120_000);

  /** Propose and execute a governed action (threshold is 1 on a fresh chain). */
  async function govern(target: Hex, payload: Hex): Promise<void> {
    const config = { rpcUrl: RPC_URL!, chainId: CHAIN_ID };
    const publicClient = createLedgerPublicClient(config);
    const wallet = createLedgerWalletClient(config, account);

    for (const functionName of ['proposeAction', 'executeAction'] as const) {
      const { request } = await publicClient.simulateContract({
        account,
        address: addresses.Governance,
        abi: governanceAbi,
        functionName,
        args: [target, payload],
        chain: wallet.chain,
      });
      const hash = await wallet.writeContract(request as never);
      await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    }
  }

  it('registers an issuer readable through keyAt', async () => {
    const issuer = await reader.getIssuer(orgId);
    expect(issuer.exists).toBe(true);
    expect(issuer.status).toBe('ACTIVE');
    expect(issuer.accreditation).toBe('UGC_RECOGNIZED');
    expect(issuer.didWeb).toBe('did:web:test.civiledger.com.bd');

    const now = Math.floor(Date.now() / 1000);
    const key = await reader.keyAt(orgId, now);
    expect(key.valid).toBe(true);
    expect(key.thumbprint).toBe(keccak256(stringToHex('key-1')));
    expect(key.reason).toBeUndefined();
  });

  it('agrees with Solidity on every Merkle proof in a batch', async () => {
    const leaves = Array.from({ length: 33 }, (_, i) =>
      anchorLeaf(keccak256(stringToHex(`salt-${i}`)), keccak256(stringToHex(`cred-${i}`))),
    );
    const tree = buildMerkleTree(leaves);

    const result = await writer.anchorBatch({
      orgId,
      merkleRoot: tree.root,
      leafCount: leaves.length,
      manifestUri: 'https://civiledger.com.bd/anchors/test/1',
    });
    expect(result.txHash).toMatch(/^0x[0-9a-f]{64}$/);

    const batchId = keccak256(
      `0x${orgId.slice(2)}${tree.root.slice(2)}${leaves.length.toString(16).padStart(64, '0')}`,
    );
    const batch = await reader.getBatch(batchId);
    expect(batch?.merkleRoot).toBe(tree.root);
    expect(batch?.leafCount).toBe(33);

    // The real assertion: the contract accepts a proof this package generated,
    // for every leaf — including the promoted odd ones.
    for (const leaf of leaves) {
      const proof = merkleProof(tree, leaf);
      expect(await reader.verifyInclusion(batchId, leaf, proof)).toBe(true);
    }

    const outsider = anchorLeaf(keccak256(stringToHex('salt-x')), keccak256(stringToHex('cred-x')));
    expect(await reader.verifyInclusion(batchId, outsider, merkleProof(tree, leaves[0]!))).toBe(
      false,
    );
  }, 180_000);

  it('refuses a status list version that does not increase', async () => {
    const listHash = keccak256(stringToHex('list-v1'));
    const uri = 'https://civiledger.com.bd/status/test/1';
    await writer.publishStatusList({ orgId, listId: 1, listHash, uri, version: 1 });

    const published = await reader.getStatusList(orgId, 1);
    expect(published).toMatchObject({ listHash, uri, version: 1 });

    await expect(
      writer.publishStatusList({
        orgId,
        listId: 1,
        listHash: keccak256(stringToHex('list-v0-replayed')),
        uri,
        version: 1,
      }),
    ).rejects.toThrow();

    await writer.publishStatusList({
      orgId,
      listId: 1,
      listHash: keccak256(stringToHex('list-v2')),
      uri,
      version: 2,
    });
    expect((await reader.getStatusList(orgId, 1))?.version).toBe(2);
  }, 120_000);

  it('keeps credentials signed before a key compromise verifiable', async () => {
    const signedAt = (await reader.getEpochs(orgId))[0]!.validFrom;
    const compromisedAt = signedAt + 3600;

    await govern(
      addresses.IssuerRegistry,
      encodeFunctionData({
        abi: issuerRegistryAbi,
        functionName: 'revokeKey',
        args: [orgId, 0, reasonCode('KEY_COMPROMISE'), BigInt(compromisedAt)],
      }),
    );

    const before = await reader.keyAt(orgId, compromisedAt - 1);
    expect(before.valid).toBe(true);
    expect(before.reason).toBe('KEY_COMPROMISE');

    const after = await reader.keyAt(orgId, compromisedAt);
    expect(after.valid).toBe(false);
    expect(after.reason).toBe('KEY_COMPROMISE');
  }, 120_000);
});
