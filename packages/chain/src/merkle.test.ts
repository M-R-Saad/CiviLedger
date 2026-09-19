import { describe, expect, it } from 'vitest';
import { keccak256, stringToHex } from 'viem';
import {
  anchorLeaf,
  buildMerkleTree,
  hashPair,
  merkleProof,
  MerkleError,
  verifyMerkleProof,
} from './merkle.js';
import { orgIdOf } from './registry.js';
import { reasonCode } from './anchor.js';
import { parseContractAddresses, ChainConfigError } from './client.js';

const digest = (s: string): string => keccak256(stringToHex(s));

describe('anchor leaves', () => {
  it('is a salted digest, so the chain leaks nothing about the credential', () => {
    const salt = digest('salt-for-this-credential');
    const sdJwt = digest('the issued sd-jwt');
    const leaf = anchorLeaf(salt, sdJwt);

    expect(leaf).toMatch(/^0x[0-9a-f]{64}$/);
    // Without the salt the leaf cannot be reproduced, so an observer holding
    // the chain cannot test a guess at the credential.
    expect(anchorLeaf(digest('a different salt'), sdJwt)).not.toBe(leaf);
    expect(leaf).toBe(anchorLeaf(salt, sdJwt));
  });

  it('rejects malformed inputs rather than silently hashing them', () => {
    expect(() => anchorLeaf('0xdeadbeef', digest('x'))).toThrow(MerkleError);
    expect(() => anchorLeaf(digest('x'), 'not-hex')).toThrow(MerkleError);
  });
});

describe('merkle tree', () => {
  const leaves = Array.from({ length: 7 }, (_, i) =>
    anchorLeaf(digest(`salt${i}`), digest(`cred${i}`)),
  );

  it('builds a root and proves every leaf', () => {
    const tree = buildMerkleTree(leaves);
    for (const leaf of leaves) {
      const proof = merkleProof(tree, leaf);
      expect(verifyMerkleProof(leaf, proof, tree.root)).toBe(true);
    }
  });

  it('rejects a leaf that is not in the batch', () => {
    const tree = buildMerkleTree(leaves);
    const outsider = anchorLeaf(digest('salt-x'), digest('cred-x'));
    const proof = merkleProof(tree, leaves[0]!);
    expect(verifyMerkleProof(outsider, proof, tree.root)).toBe(false);
    expect(() => merkleProof(tree, outsider)).toThrow(/not in this batch/);
  });

  it('handles a single-leaf batch', () => {
    const tree = buildMerkleTree([leaves[0]!]);
    expect(tree.root).toBe(leaves[0]);
    expect(merkleProof(tree, leaves[0]!)).toEqual([]);
    expect(verifyMerkleProof(leaves[0]!, [], tree.root)).toBe(true);
  });

  it('sorts pairs so proofs need no order flags', () => {
    const a = digest('a');
    const b = digest('b');
    expect(hashPair(a, b)).toBe(hashPair(b, a));
  });

  it('refuses an empty batch', () => {
    expect(() => buildMerkleTree([])).toThrow(/empty batch/);
  });

  it('refuses duplicate leaves', () => {
    expect(() => buildMerkleTree([leaves[0]!, leaves[0]!])).toThrow(/duplicate leaf/);
  });

  it('produces a different root when any leaf changes', () => {
    const first = buildMerkleTree(leaves).root;
    const tampered = [...leaves];
    tampered[3] = anchorLeaf(digest('salt3'), digest('cred3-altered'));
    expect(buildMerkleTree(tampered).root).not.toBe(first);
  });

  it('scales to a realistic graduating cohort', () => {
    const cohort = Array.from({ length: 1_000 }, (_, i) =>
      anchorLeaf(digest(`s${i}`), digest(`c${i}`)),
    );
    const tree = buildMerkleTree(cohort);
    const proof = merkleProof(tree, cohort[737]!);
    // log2(1000) ≈ 10 — one transaction anchors the whole cohort.
    expect(proof.length).toBeLessThanOrEqual(10);
    expect(verifyMerkleProof(cohort[737]!, proof, tree.root)).toBe(true);
  });
});

describe('organisation identifiers', () => {
  it('is deterministic and case-insensitive', () => {
    expect(orgIdOf('uiu')).toBe(orgIdOf('  UIU '));
    expect(orgIdOf('uiu')).toMatch(/^0x[0-9a-f]{64}$/);
    expect(orgIdOf('uiu')).not.toBe(orgIdOf('bmdc'));
  });

  it('rejects slugs that are not institutional identifiers', () => {
    expect(() => orgIdOf('')).toThrow();
    expect(() => orgIdOf('a')).toThrow();
    expect(() => orgIdOf('has spaces')).toThrow();
    expect(() => orgIdOf('-leading-dash')).toThrow();
  });
});

describe('reason codes', () => {
  it('encodes a code as right-padded bytes32', () => {
    expect(reasonCode('KEY_COMPROMISE')).toMatch(/^0x4b45595f434f4d50524f4d4953450+$/);
  });

  it('refuses free text, which would put PII on chain', () => {
    expect(() => reasonCode('Document found to be fraudulent')).toThrow(/never free text/);
    expect(() => reasonCode('lowercase')).toThrow();
    expect(() => reasonCode('A'.repeat(32))).toThrow();
  });
});

describe('address book', () => {
  const valid = {
    Governance: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    IssuerRegistry: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    StatusRegistry: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    AnchorRegistry: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    AuditAnchor: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
  };

  it('accepts a complete deployment', () => {
    expect(parseContractAddresses(valid).Governance).toBe(valid.Governance);
  });

  it('fails loudly on a partial deployment rather than at first use', () => {
    const { AuditAnchor: _omitted, ...partial } = valid;
    expect(() => parseContractAddresses(partial)).toThrow(ChainConfigError);
    expect(() => parseContractAddresses({ ...valid, StatusRegistry: '0xnope' })).toThrow(
      /StatusRegistry/,
    );
    expect(() => parseContractAddresses(null)).toThrow(ChainConfigError);
  });
});
