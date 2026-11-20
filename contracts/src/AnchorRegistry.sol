// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IssuerRegistry} from "./IssuerRegistry.sol";

/// @title AnchorRegistry
/// @notice Proof that a set of credentials existed, unchanged, at a point in
///         time. PLAN.html §6 job 3.
/// @dev One transaction anchors a whole batch as a Merkle root. A leaf is
///      keccak256(salt || sd-jwt-digest) and the salt never leaves the database:
///      destroying the off-chain row renders the on-chain leaf an unlinkable
///      random value, which is how erasure is implemented under the PDPA
///      (PLAN §6.2, §18).
///
///      Consequently nothing here is personal data, and no leaf can be
///      recomputed by an observer. Inclusion proofs are verified off chain by
///      the verifier library; `verifyInclusion` is provided so a third party can
///      check one against the chain directly, without trusting our API.
contract AnchorRegistry {
    struct Batch {
        bytes32 orgId;
        bytes32 merkleRoot;
        uint32 leafCount;
        uint64 anchoredAt;
        /// @dev Where the batch manifest lives. Institutional URL, never PII.
        string manifestUri;
        bool exists;
    }

    IssuerRegistry public immutable issuerRegistry;

    mapping(bytes32 => Batch) private _batches;
    bytes32[] private _batchIds;

    event BatchAnchored(
        bytes32 indexed batchId,
        bytes32 indexed orgId,
        bytes32 merkleRoot,
        uint32 leafCount,
        uint64 anchoredAt
    );

    error NotOperator();
    error ZeroRoot();
    error EmptyBatch();
    error BatchExists();
    error UnknownBatch();
    error EmptyUri();

    constructor(address issuerRegistry_) {
        issuerRegistry = IssuerRegistry(issuerRegistry_);
    }

    /// @notice Deterministic batch identifier.
    /// @dev Derived from the content rather than from a counter or a timestamp,
    ///      so the anchoring transaction is idempotent: a retry after a dropped
    ///      receipt reverts with `BatchExists` instead of double-anchoring.
    function batchIdOf(bytes32 orgId, bytes32 merkleRoot, uint32 leafCount)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(orgId, merkleRoot, leafCount));
    }

    function anchorBatch(
        bytes32 orgId,
        bytes32 merkleRoot,
        uint32 leafCount,
        string calldata manifestUri
    ) external returns (bytes32 batchId) {
        if (!issuerRegistry.isOperator(orgId, msg.sender)) revert NotOperator();
        if (merkleRoot == bytes32(0)) revert ZeroRoot();
        if (leafCount == 0) revert EmptyBatch();
        if (bytes(manifestUri).length == 0) revert EmptyUri();

        batchId = batchIdOf(orgId, merkleRoot, leafCount);
        Batch storage batch = _batches[batchId];
        if (batch.exists) revert BatchExists();

        batch.orgId = orgId;
        batch.merkleRoot = merkleRoot;
        batch.leafCount = leafCount;
        batch.anchoredAt = uint64(block.timestamp);
        batch.manifestUri = manifestUri;
        batch.exists = true;
        _batchIds.push(batchId);

        emit BatchAnchored(batchId, orgId, merkleRoot, leafCount, batch.anchoredAt);
    }

    function getBatch(bytes32 batchId)
        external
        view
        returns (bytes32 orgId, bytes32 merkleRoot, uint32 leafCount, uint64 anchoredAt, string memory manifestUri)
    {
        Batch storage batch = _batches[batchId];
        if (!batch.exists) revert UnknownBatch();
        return (batch.orgId, batch.merkleRoot, batch.leafCount, batch.anchoredAt, batch.manifestUri);
    }

    function exists(bytes32 batchId) external view returns (bool) {
        return _batches[batchId].exists;
    }

    function batchCount() external view returns (uint256) {
        return _batchIds.length;
    }

    function batchIdAt(uint256 index) external view returns (bytes32) {
        return _batchIds[index];
    }

    /// @notice Check a Merkle inclusion proof against an anchored batch.
    /// @param leaf keccak256(salt || sdJwtDigest), computed off chain.
    /// @dev Sorted-pair hashing, so the proof carries no sibling-order flags.
    function verifyInclusion(bytes32 batchId, bytes32 leaf, bytes32[] calldata proof)
        external
        view
        returns (bool)
    {
        Batch storage batch = _batches[batchId];
        if (!batch.exists) revert UnknownBatch();

        bytes32 computed = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 sibling = proof[i];
            computed = computed <= sibling
                ? keccak256(abi.encodePacked(computed, sibling))
                : keccak256(abi.encodePacked(sibling, computed));
        }
        return computed == batch.merkleRoot;
    }
}
