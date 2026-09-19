// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./Base.t.sol";
import {AnchorRegistry} from "../src/AnchorRegistry.sol";
import {AuditAnchor} from "../src/AuditAnchor.sol";
import {IssuerRegistry} from "../src/IssuerRegistry.sol";
import {StatusRegistry} from "../src/StatusRegistry.sol";

contract StatusRegistryTest is BaseTest {
    bytes32 internal constant HASH_V1 = keccak256("list.v1");
    bytes32 internal constant HASH_V2 = keccak256("list.v2");
    string internal constant URI = "https://civiledger.com.bd/status/uiu/3";

    function setUp() public override {
        super.setUp();
        _registerUiu();
    }

    function test_publishAndRead() public {
        vm.prank(operator);
        statuses.publishStatusList(ORG_UIU, 3, HASH_V1, URI, 1);

        (bytes32 listHash, string memory uri, uint64 version, uint64 updatedAt) =
            statuses.getStatusList(ORG_UIU, 3);
        assertEq(listHash, HASH_V1);
        assertEq(uri, URI);
        assertEq(version, 1);
        assertEq(updatedAt, uint64(block.timestamp));
        assertTrue(statuses.exists(ORG_UIU, 3));
    }

    function test_versionMustStrictlyIncrease() public {
        vm.startPrank(operator);
        statuses.publishStatusList(ORG_UIU, 3, HASH_V1, URI, 212);

        // Replaying the same version with different content is the CDN attack:
        // a valid signature over a stale list. The chain must refuse it.
        vm.expectRevert(abi.encodeWithSelector(StatusRegistry.VersionNotIncreasing.selector, 212, 212));
        statuses.publishStatusList(ORG_UIU, 3, HASH_V2, URI, 212);

        vm.expectRevert(abi.encodeWithSelector(StatusRegistry.VersionNotIncreasing.selector, 211, 212));
        statuses.publishStatusList(ORG_UIU, 3, HASH_V2, URI, 211);

        statuses.publishStatusList(ORG_UIU, 3, HASH_V2, URI, 213);
        vm.stopPrank();

        (bytes32 listHash,, uint64 version,) = statuses.getStatusList(ORG_UIU, 3);
        assertEq(listHash, HASH_V2);
        assertEq(version, 213);
    }

    function test_onlyTheIssuersOwnOperatorMayPublish() public {
        vm.prank(stranger);
        vm.expectRevert(StatusRegistry.NotOperator.selector);
        statuses.publishStatusList(ORG_UIU, 3, HASH_V1, URI, 1);

        // An operator authorised for one institution cannot publish for another.
        bytes32 otherOrg = keccak256("org.other");
        _govern(
            address(issuers),
            abi.encodeCall(
                IssuerRegistry.registerIssuer,
                (otherOrg, "did:web:other", IssuerRegistry.Accreditation.BOARD, keccak256("k"), 0)
            )
        );
        vm.prank(operator);
        vm.expectRevert(StatusRegistry.NotOperator.selector);
        statuses.publishStatusList(otherOrg, 1, HASH_V1, URI, 1);
    }

    function test_suspendedIssuerCannotPublish() public {
        _govern(
            address(issuers),
            abi.encodeCall(IssuerRegistry.setStatus, (ORG_UIU, IssuerRegistry.IssuerStatus.SUSPENDED))
        );
        vm.prank(operator);
        vm.expectRevert(StatusRegistry.NotOperator.selector);
        statuses.publishStatusList(ORG_UIU, 3, HASH_V1, URI, 1);
    }

    function test_rejectsEmptyValues() public {
        vm.startPrank(operator);
        vm.expectRevert(StatusRegistry.ZeroHash.selector);
        statuses.publishStatusList(ORG_UIU, 3, bytes32(0), URI, 1);
        vm.expectRevert(StatusRegistry.EmptyUri.selector);
        statuses.publishStatusList(ORG_UIU, 3, HASH_V1, "", 1);
        vm.stopPrank();
    }

    function test_unknownListReverts() public {
        vm.expectRevert(StatusRegistry.UnknownList.selector);
        statuses.getStatusList(ORG_UIU, 99);
        assertFalse(statuses.exists(ORG_UIU, 99));
    }

    function test_separateListsAreIndependent() public {
        vm.startPrank(operator);
        statuses.publishStatusList(ORG_UIU, 3, HASH_V1, URI, 5);
        // A suspension-purpose list keeps its own version counter.
        statuses.publishStatusList(ORG_UIU, 4, HASH_V2, URI, 1);
        vm.stopPrank();

        (, , uint64 v3,) = statuses.getStatusList(ORG_UIU, 3);
        (, , uint64 v4,) = statuses.getStatusList(ORG_UIU, 4);
        assertEq(v3, 5);
        assertEq(v4, 1);
    }

    function testFuzz_versionNeverGoesBackwards(uint64 first, uint64 second) public {
        first = uint64(bound(first, 1, type(uint64).max - 1));
        vm.prank(operator);
        statuses.publishStatusList(ORG_UIU, 3, HASH_V1, URI, first);

        vm.prank(operator);
        if (second <= first) {
            vm.expectRevert(
                abi.encodeWithSelector(StatusRegistry.VersionNotIncreasing.selector, second, first)
            );
            statuses.publishStatusList(ORG_UIU, 3, HASH_V2, URI, second);
        } else {
            statuses.publishStatusList(ORG_UIU, 3, HASH_V2, URI, second);
            (, , uint64 stored,) = statuses.getStatusList(ORG_UIU, 3);
            assertEq(stored, second);
        }
    }
}

contract AnchorRegistryTest is BaseTest {
    bytes32 internal constant ROOT = keccak256("batch.root");
    string internal constant MANIFEST = "https://civiledger.com.bd/anchors/uiu/2027-02";

    function setUp() public override {
        super.setUp();
        _registerUiu();
    }

    function test_anchorAndRead() public {
        vm.prank(operator);
        bytes32 batchId = anchors.anchorBatch(ORG_UIU, ROOT, 412, MANIFEST);

        assertEq(batchId, anchors.batchIdOf(ORG_UIU, ROOT, 412));
        (bytes32 orgId, bytes32 root, uint32 leaves, uint64 at, string memory manifest) =
            anchors.getBatch(batchId);
        assertEq(orgId, ORG_UIU);
        assertEq(root, ROOT);
        assertEq(leaves, 412);
        assertEq(at, uint64(block.timestamp));
        assertEq(manifest, MANIFEST);
        assertEq(anchors.batchCount(), 1);
        assertEq(anchors.batchIdAt(0), batchId);
    }

    function test_anchoringIsIdempotentSoARetryCannotDoubleAnchor() public {
        vm.startPrank(operator);
        anchors.anchorBatch(ORG_UIU, ROOT, 412, MANIFEST);
        vm.expectRevert(AnchorRegistry.BatchExists.selector);
        anchors.anchorBatch(ORG_UIU, ROOT, 412, MANIFEST);
        vm.stopPrank();
        assertEq(anchors.batchCount(), 1);
    }

    function test_onlyOperatorMayAnchor() public {
        vm.prank(stranger);
        vm.expectRevert(AnchorRegistry.NotOperator.selector);
        anchors.anchorBatch(ORG_UIU, ROOT, 1, MANIFEST);
    }

    function test_rejectsEmptyBatches() public {
        vm.startPrank(operator);
        vm.expectRevert(AnchorRegistry.ZeroRoot.selector);
        anchors.anchorBatch(ORG_UIU, bytes32(0), 1, MANIFEST);
        vm.expectRevert(AnchorRegistry.EmptyBatch.selector);
        anchors.anchorBatch(ORG_UIU, ROOT, 0, MANIFEST);
        vm.expectRevert(AnchorRegistry.EmptyUri.selector);
        anchors.anchorBatch(ORG_UIU, ROOT, 1, "");
        vm.stopPrank();
    }

    function test_unknownBatchReverts() public {
        vm.expectRevert(AnchorRegistry.UnknownBatch.selector);
        anchors.getBatch(keccak256("nope"));
        assertFalse(anchors.exists(keccak256("nope")));
    }

    function test_verifyInclusionAcceptsAValidProof() public {
        // Four leaves. Leaf = keccak256(salt || sdJwtDigest), computed off chain;
        // the salt never leaves the database, so no observer can rebuild a leaf.
        bytes32 l0 = keccak256(abi.encodePacked(keccak256("salt0"), keccak256("digest0")));
        bytes32 l1 = keccak256(abi.encodePacked(keccak256("salt1"), keccak256("digest1")));
        bytes32 l2 = keccak256(abi.encodePacked(keccak256("salt2"), keccak256("digest2")));
        bytes32 l3 = keccak256(abi.encodePacked(keccak256("salt3"), keccak256("digest3")));

        bytes32 n01 = _hashPair(l0, l1);
        bytes32 n23 = _hashPair(l2, l3);
        bytes32 root = _hashPair(n01, n23);

        vm.prank(operator);
        bytes32 batchId = anchors.anchorBatch(ORG_UIU, root, 4, MANIFEST);

        bytes32[] memory proof = new bytes32[](2);
        proof[0] = l1;
        proof[1] = n23;
        assertTrue(anchors.verifyInclusion(batchId, l0, proof));

        // A leaf that was never in the batch must not verify.
        assertFalse(
            anchors.verifyInclusion(
                batchId, keccak256(abi.encodePacked(keccak256("salt9"), keccak256("digest9"))), proof
            )
        );
    }

    function test_verifyInclusionOnUnknownBatchReverts() public {
        bytes32[] memory proof = new bytes32[](0);
        vm.expectRevert(AnchorRegistry.UnknownBatch.selector);
        anchors.verifyInclusion(keccak256("nope"), ROOT, proof);
    }

    function _hashPair(bytes32 a, bytes32 b) private pure returns (bytes32) {
        return a <= b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }
}

contract AuditAnchorTest is BaseTest {
    bytes32 internal constant ROOT = keccak256("receipts.2027-03-14");

    function test_anchorAuditAndRead() public {
        uint64 periodStart = uint64(block.timestamp) - 1 days;
        vm.prank(oracle);
        audit.anchorAudit(periodStart, ROOT, 1_204);

        (bytes32 root, uint32 leaves, uint64 at) = audit.getAudit(periodStart);
        assertEq(root, ROOT);
        assertEq(leaves, 1_204);
        assertEq(at, uint64(block.timestamp));
        assertEq(audit.auditPeriodCount(), 1);
        assertEq(audit.auditPeriodAt(0), periodStart);
    }

    function test_aPeriodCanOnlyBeAnchoredOnce() public {
        uint64 periodStart = uint64(block.timestamp) - 1 days;
        vm.startPrank(oracle);
        audit.anchorAudit(periodStart, ROOT, 10);
        // Re-anchoring would let an operator swap a day's receipts after the
        // fact, which is precisely the tampering this prevents.
        vm.expectRevert(AuditAnchor.PeriodExists.selector);
        audit.anchorAudit(periodStart, keccak256("different"), 10);
        vm.stopPrank();
    }

    function test_onlyOracleMayAnchor() public {
        vm.prank(stranger);
        vm.expectRevert(AuditAnchor.NotOracle.selector);
        audit.anchorAudit(uint64(block.timestamp) - 1, ROOT, 1);

        vm.prank(adminCiviledger);
        vm.expectRevert(AuditAnchor.NotOracle.selector);
        audit.checkpoint(ROOT, 1);
    }

    function test_rejectsFuturePeriodsAndZeroRoots() public {
        vm.startPrank(oracle);
        vm.expectRevert(AuditAnchor.PeriodInFuture.selector);
        audit.anchorAudit(uint64(block.timestamp) + 1, ROOT, 1);
        vm.expectRevert(AuditAnchor.ZeroRoot.selector);
        audit.anchorAudit(uint64(block.timestamp) - 1, bytes32(0), 1);
        vm.expectRevert(AuditAnchor.ZeroRoot.selector);
        audit.checkpoint(bytes32(0), 1);
        vm.stopPrank();
    }

    function test_checkpointsMustAdvance() public {
        vm.startPrank(oracle);
        audit.checkpoint(keccak256("state.1"), 1_000);
        vm.expectRevert(abi.encodeWithSelector(AuditAnchor.CheckpointNotAdvancing.selector, 1_000, 1_000));
        audit.checkpoint(keccak256("state.2"), 1_000);
        audit.checkpoint(keccak256("state.2"), 1_001);
        vm.stopPrank();

        assertEq(audit.checkpointCount(), 2);
        AuditAnchor.Checkpoint memory latest = audit.latestCheckpoint();
        assertEq(latest.blockNumber, 1_001);
        assertEq(latest.stateRoot, keccak256("state.2"));
        assertEq(audit.getCheckpoint(0).blockNumber, 1_000);
    }

    function test_verifyReceiptProvesOneReceiptWithoutRevealingTheDatabase() public {
        bytes32 r0 = keccak256("receipt.0");
        bytes32 r1 = keccak256("receipt.1");
        bytes32 root = r0 <= r1 ? keccak256(abi.encodePacked(r0, r1)) : keccak256(abi.encodePacked(r1, r0));

        uint64 periodStart = uint64(block.timestamp) - 1 days;
        vm.prank(oracle);
        audit.anchorAudit(periodStart, root, 2);

        bytes32[] memory proof = new bytes32[](1);
        proof[0] = r1;
        assertTrue(audit.verifyReceipt(periodStart, r0, proof));
        assertFalse(audit.verifyReceipt(periodStart, keccak256("receipt.fake"), proof));
    }

    function test_unknownPeriodReverts() public {
        bytes32[] memory proof = new bytes32[](0);
        vm.expectRevert(AuditAnchor.UnknownPeriod.selector);
        audit.getAudit(1);
        vm.expectRevert(AuditAnchor.UnknownPeriod.selector);
        audit.verifyReceipt(1, ROOT, proof);
    }
}
