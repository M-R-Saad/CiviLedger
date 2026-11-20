/**
 * Merkle trees for batch anchoring. PLAN.html §11, AnchorRegistry.
 *
 * Leaf = keccak256(salt || sdJwtDigest). The salt is a per-credential secret
 * held only in the database, so an observer holding the chain cannot rebuild a
 * leaf, cannot test a guess against it, and cannot link two anchors to one
 * person. Destroying the salt row severs the credential from its anchor
 * permanently — that is how erasure is implemented (PLAN §6.2, §18).
 *
 * Internal nodes use sorted-pair hashing, matching
 * `AnchorRegistry.verifyInclusion` and `AuditAnchor.verifyReceipt`, so a proof
 * needs no sibling-order flags.
 */

import { concatHex, keccak256, type Hex } from 'viem';

export class MerkleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MerkleError';
  }
}

export interface MerkleTree {
  root: Hex;
  leaves: Hex[];
  /** Level 0 is the leaves; the last level is the single root. */
  levels: Hex[][];
}

const HEX32 = /^0x[0-9a-f]{64}$/;

function assertHex32(value: string, what: string): Hex {
  const lower = value.toLowerCase();
  if (!HEX32.test(lower)) {
    throw new MerkleError(`${what} must be a 0x-prefixed 32-byte hex string`);
  }
  return lower as Hex;
}

/** Hash a pair in sorted order, exactly as the Solidity side does. */
export function hashPair(a: Hex, b: Hex): Hex {
  return a.toLowerCase() <= b.toLowerCase()
    ? keccak256(concatHex([a, b]))
    : keccak256(concatHex([b, a]));
}

/**
 * Compute a credential's anchor leaf.
 * @param salt per-credential secret, 32 bytes, never leaves the database
 * @param sdJwtDigest sha-256 over the issued SD-JWT, as 32-byte hex
 */
export function anchorLeaf(salt: string, sdJwtDigest: string): Hex {
  return keccak256(
    concatHex([assertHex32(salt, 'salt'), assertHex32(sdJwtDigest, 'sd-jwt digest')]),
  );
}

export function buildMerkleTree(leafInput: readonly string[]): MerkleTree {
  if (leafInput.length === 0) {
    throw new MerkleError('cannot anchor an empty batch');
  }
  const leaves = leafInput.map((leaf, i) => assertHex32(leaf, `leaf ${i}`));

  // Duplicate leaves would make an inclusion proof ambiguous about *which*
  // credential it proves, and in practice mean the same credential was queued
  // into one batch twice.
  const seen = new Set<string>();
  for (const leaf of leaves) {
    if (seen.has(leaf)) throw new MerkleError(`duplicate leaf ${leaf} in batch`);
    seen.add(leaf);
  }

  const levels: Hex[][] = [leaves];
  let current = leaves;

  while (current.length > 1) {
    const next: Hex[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i]!;
      const right = current[i + 1];
      // An odd node is promoted unchanged rather than paired with itself:
      // self-pairing is the classic second-preimage foot-gun.
      next.push(right === undefined ? left : hashPair(left, right));
    }
    levels.push(next);
    current = next;
  }

  return { root: current[0]!, leaves, levels };
}

/** The sibling path proving `leaf` is in the tree. */
export function merkleProof(tree: MerkleTree, leaf: string): Hex[] {
  const target = assertHex32(leaf, 'leaf');
  let index = tree.leaves.indexOf(target);
  if (index === -1) {
    throw new MerkleError('leaf is not in this batch');
  }

  const proof: Hex[] = [];
  for (let level = 0; level < tree.levels.length - 1; level += 1) {
    const nodes = tree.levels[level]!;
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    const sibling = nodes[siblingIndex];
    // No sibling means this node was promoted; nothing to add to the proof.
    if (sibling !== undefined) proof.push(sibling);
    index = Math.floor(index / 2);
  }
  return proof;
}

/** Verify a proof locally — the same computation AnchorRegistry performs. */
export function verifyMerkleProof(leaf: string, proof: readonly string[], root: string): boolean {
  let computed = assertHex32(leaf, 'leaf');
  for (const [i, sibling] of proof.entries()) {
    computed = hashPair(computed, assertHex32(sibling, `proof element ${i}`));
  }
  return computed === assertHex32(root, 'root');
}
