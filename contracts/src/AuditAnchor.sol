// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Governance} from "./Governance.sol";

/// @title AuditAnchor
/// @notice Nightly consent-receipt roots and the weekly public checkpoint.
///         PLAN.html §6 job 4, §10.
/// @dev Per-presentation on-chain writes would publish a verification graph —
///      who checked whom, when — which is the single most sensitive dataset the
///      system will ever hold. Invariant §25 forbids them outright. Instead, a
///      Merkle tree is built over the day's receipt digests off chain and only
///      the root is recorded here. An oversight body can be handed an inclusion
///      proof for any one receipt without being handed the receipt database.
///
///      `checkpoint` answers "your three nodes could collude": the consortium's
///      state root is mirrored to a public network weekly, so any rewrite of
///      this chain's history becomes externally provable.
contract AuditAnchor {
    struct AuditPeriod {
        bytes32 merkleRoot;
        uint32 leafCount;
        uint64 anchoredAt;
        bool exists;
    }

    struct Checkpoint {
        bytes32 stateRoot;
        uint64 blockNumber;
        uint64 recordedAt;
    }

    Governance public immutable governance;

    /// @dev periodStart (unix seconds, midnight Asia/Dhaka) => period.
    mapping(uint64 => AuditPeriod) private _periods;
    uint64[] private _periodStarts;

    Checkpoint[] private _checkpoints;

    event AuditAnchored(
        uint64 indexed periodStart, bytes32 merkleRoot, uint32 leafCount, uint64 anchoredAt
    );
    event CheckpointRecorded(
        uint256 indexed index, bytes32 stateRoot, uint64 blockNumber, uint64 recordedAt
    );

    error NotOracle();
    error ZeroRoot();
    error PeriodExists();
    error UnknownPeriod();
    error PeriodInFuture();
    error CheckpointNotAdvancing(uint64 submitted, uint64 latest);

    modifier onlyOracle() {
        if (!governance.hasRole(governance.ORACLE_ROLE(), msg.sender)) revert NotOracle();
        _;
    }

    constructor(address governance_) {
        governance = Governance(governance_);
    }

    /// @notice Anchor the Merkle root over one day's consent receipts.
    /// @dev A period may be anchored once. Re-anchoring would let an operator
    ///      swap a day's receipts for a different set after the fact, which is
    ///      exactly the tampering this is meant to make impossible.
    function anchorAudit(uint64 periodStart, bytes32 merkleRoot, uint32 leafCount)
        external
        onlyOracle
    {
        if (merkleRoot == bytes32(0)) revert ZeroRoot();
        if (periodStart > block.timestamp) revert PeriodInFuture();
        AuditPeriod storage period = _periods[periodStart];
        if (period.exists) revert PeriodExists();

        period.merkleRoot = merkleRoot;
        period.leafCount = leafCount;
        period.anchoredAt = uint64(block.timestamp);
        period.exists = true;
        _periodStarts.push(periodStart);

        emit AuditAnchored(periodStart, merkleRoot, leafCount, period.anchoredAt);
    }

    /// @notice Record this chain's state root for mirroring to a public network.
    function checkpoint(bytes32 stateRoot, uint64 blockNumber) external onlyOracle {
        if (stateRoot == bytes32(0)) revert ZeroRoot();
        uint64 latest = _checkpoints.length == 0 ? 0 : _checkpoints[_checkpoints.length - 1].blockNumber;
        if (_checkpoints.length != 0 && blockNumber <= latest) {
            revert CheckpointNotAdvancing(blockNumber, latest);
        }

        _checkpoints.push(
            Checkpoint({stateRoot: stateRoot, blockNumber: blockNumber, recordedAt: uint64(block.timestamp)})
        );
        emit CheckpointRecorded(_checkpoints.length - 1, stateRoot, blockNumber, uint64(block.timestamp));
    }

    function getAudit(uint64 periodStart)
        external
        view
        returns (bytes32 merkleRoot, uint32 leafCount, uint64 anchoredAt)
    {
        AuditPeriod storage period = _periods[periodStart];
        if (!period.exists) revert UnknownPeriod();
        return (period.merkleRoot, period.leafCount, period.anchoredAt);
    }

    function auditPeriodCount() external view returns (uint256) {
        return _periodStarts.length;
    }

    function auditPeriodAt(uint256 index) external view returns (uint64) {
        return _periodStarts[index];
    }

    function checkpointCount() external view returns (uint256) {
        return _checkpoints.length;
    }

    function getCheckpoint(uint256 index) external view returns (Checkpoint memory) {
        return _checkpoints[index];
    }

    function latestCheckpoint() external view returns (Checkpoint memory) {
        return _checkpoints[_checkpoints.length - 1];
    }

    /// @notice Verify that a receipt digest was included in a day's anchored root.
    /// @dev Sorted-pair hashing, matching AnchorRegistry.
    function verifyReceipt(uint64 periodStart, bytes32 receiptDigest, bytes32[] calldata proof)
        external
        view
        returns (bool)
    {
        AuditPeriod storage period = _periods[periodStart];
        if (!period.exists) revert UnknownPeriod();

        bytes32 computed = receiptDigest;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 sibling = proof[i];
            computed = computed <= sibling
                ? keccak256(abi.encodePacked(computed, sibling))
                : keccak256(abi.encodePacked(sibling, computed));
        }
        return computed == period.merkleRoot;
    }
}
