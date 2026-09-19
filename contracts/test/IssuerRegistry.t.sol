// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./Base.t.sol";
import {IssuerRegistry} from "../src/IssuerRegistry.sol";

/// @dev PLAN.html §11 sets a 95% line-coverage floor on this contract and
///      requires fuzz tests on `keyAt` across rotation boundaries. The
///      boundary cases are the ones that matter: a credential signed one
///      second either side of a rotation must resolve to a different key, and
///      a rotation must never invalidate history (invariant §25).
contract IssuerRegistryTest is BaseTest {
    function setUp() public override {
        super.setUp();
        _registerUiu();
    }

    // ---------------------------------------------------------------
    // Registration
    // ---------------------------------------------------------------

    function test_registerIssuer_storesIssuerAndFirstEpoch() public view {
        IssuerRegistry.Issuer memory issuer = issuers.getIssuer(ORG_UIU);
        assertEq(issuer.didWeb, "did:web:civiledger.com.bd:issuers:uiu");
        assertEq(uint8(issuer.accreditation), uint8(IssuerRegistry.Accreditation.UGC_RECOGNIZED));
        assertEq(uint8(issuer.status), uint8(IssuerRegistry.IssuerStatus.ACTIVE));
        assertTrue(issuer.exists);
        assertEq(issuers.epochCount(ORG_UIU), 1);
        assertTrue(issuers.isActive(ORG_UIU));
    }

    function test_registerIssuer_rejectsDirectCall() public {
        vm.prank(adminCiviledger);
        vm.expectRevert(IssuerRegistry.NotGovernance.selector);
        issuers.registerIssuer(
            keccak256("org.rogue"), "did:web:x", IssuerRegistry.Accreditation.BOARD, UIU_KEY_1, 0
        );
    }

    function test_registerIssuer_rejectsDuplicate() public {
        vm.prank(address(governance));
        vm.expectRevert(IssuerRegistry.IssuerExists.selector);
        issuers.registerIssuer(
            ORG_UIU, "did:web:x", IssuerRegistry.Accreditation.BOARD, UIU_KEY_2, 0
        );
    }

    function test_registerIssuer_rejectsZeroValues() public {
        vm.startPrank(address(governance));
        vm.expectRevert(IssuerRegistry.ZeroOrg.selector);
        issuers.registerIssuer(
            bytes32(0), "did:web:x", IssuerRegistry.Accreditation.BOARD, UIU_KEY_1, 0
        );
        vm.expectRevert(IssuerRegistry.ZeroKey.selector);
        issuers.registerIssuer(
            keccak256("o"), "did:web:x", IssuerRegistry.Accreditation.BOARD, bytes32(0), 0
        );
        vm.expectRevert(IssuerRegistry.EmptyDid.selector);
        issuers.registerIssuer(
            keccak256("o"), "", IssuerRegistry.Accreditation.BOARD, UIU_KEY_1, 0
        );
        vm.stopPrank();
    }

    // ---------------------------------------------------------------
    // keyAt — the function verifiers actually call
    // ---------------------------------------------------------------

    function test_keyAt_unknownIssuerIsNotValid() public view {
        (bytes32 thumbprint, bool valid,) = issuers.keyAt(keccak256("org.nobody"), uint64(block.timestamp));
        assertEq(thumbprint, bytes32(0));
        assertFalse(valid);
    }

    function test_keyAt_beforeFirstEpochIsNotValid() public {
        uint64 start = uint64(block.timestamp) + 1000;
        bytes32 org = keccak256("org.future");
        _govern(
            address(issuers),
            abi.encodeCall(
                IssuerRegistry.registerIssuer,
                (org, "did:web:future", IssuerRegistry.Accreditation.BOARD, UIU_KEY_1, start)
            )
        );

        (bytes32 thumbprint, bool valid,) = issuers.keyAt(org, start - 1);
        assertEq(thumbprint, bytes32(0));
        assertFalse(valid);

        (thumbprint, valid,) = issuers.keyAt(org, start);
        assertEq(thumbprint, UIU_KEY_1);
        assertTrue(valid);
    }

    function test_keyAt_resolvesAcrossRotationBoundary() public {
        uint64 rotateAt = uint64(block.timestamp) + 1 days;
        _govern(address(issuers), abi.encodeCall(IssuerRegistry.rotateKey, (ORG_UIU, UIU_KEY_2, rotateAt)));

        // One second before the rotation: the old key, still valid.
        (bytes32 before, bool beforeValid,) = issuers.keyAt(ORG_UIU, rotateAt - 1);
        assertEq(before, UIU_KEY_1);
        assertTrue(beforeValid);

        // At the boundary: the new key takes over.
        (bytes32 atBoundary, bool atValid,) = issuers.keyAt(ORG_UIU, rotateAt);
        assertEq(atBoundary, UIU_KEY_2);
        assertTrue(atValid);

        (bytes32 later, bool laterValid,) = issuers.keyAt(ORG_UIU, rotateAt + 365 days);
        assertEq(later, UIU_KEY_2);
        assertTrue(laterValid);
    }

    function test_keyAt_historySurvivesThreeRotations() public {
        uint64 t0 = uint64(block.timestamp);
        uint64 t1 = t0 + 365 days;
        uint64 t2 = t1 + 365 days;
        uint64 t3 = t2 + 365 days;

        _govern(address(issuers), abi.encodeCall(IssuerRegistry.rotateKey, (ORG_UIU, UIU_KEY_2, t1)));
        _govern(address(issuers), abi.encodeCall(IssuerRegistry.rotateKey, (ORG_UIU, UIU_KEY_3, t2)));
        bytes32 key4 = keccak256("uiu.key.4");
        _govern(address(issuers), abi.encodeCall(IssuerRegistry.rotateKey, (ORG_UIU, key4, t3)));

        // A 2027 credential must still verify in 2037. PLAN §11.
        _assertKeyAt(t0, UIU_KEY_1, true);
        _assertKeyAt(t1 - 1, UIU_KEY_1, true);
        _assertKeyAt(t1, UIU_KEY_2, true);
        _assertKeyAt(t2 - 1, UIU_KEY_2, true);
        _assertKeyAt(t2, UIU_KEY_3, true);
        _assertKeyAt(t3, key4, true);
        assertEq(issuers.epochCount(ORG_UIU), 4);
    }

    function test_rotateKey_rejectsNonIncreasingValidFrom() public {
        uint64 current = uint64(block.timestamp);
        vm.prank(address(governance));
        vm.expectRevert(
            abi.encodeWithSelector(IssuerRegistry.ValidFromNotIncreasing.selector, current, current)
        );
        issuers.rotateKey(ORG_UIU, UIU_KEY_2, current);
    }

    function test_rotateKey_rejectsUnknownIssuer() public {
        vm.prank(address(governance));
        vm.expectRevert(IssuerRegistry.UnknownIssuer.selector);
        issuers.rotateKey(keccak256("org.nobody"), UIU_KEY_2, uint64(block.timestamp) + 1);
    }

    // ---------------------------------------------------------------
    // Key revocation — the compromise window
    // ---------------------------------------------------------------

    function test_revokeKey_preservesCredentialsSignedBeforeCompromise() public {
        uint64 signedBefore = uint64(block.timestamp) + 10;
        uint64 compromisedAt = uint64(block.timestamp) + 100;
        bytes32 reason = bytes32("KEY_COMPROMISE");

        vm.warp(compromisedAt + 1);
        _govern(
            address(issuers),
            abi.encodeCall(IssuerRegistry.revokeKey, (ORG_UIU, 0, reason, compromisedAt))
        );

        // Signed before the window: still valid. This is the whole point of
        // resolving keys by signing timestamp (PLAN §12.1).
        (bytes32 thumbprint, bool valid, bytes32 gotReason) = issuers.keyAt(ORG_UIU, signedBefore);
        assertEq(thumbprint, UIU_KEY_1);
        assertTrue(valid);
        assertEq(gotReason, reason);

        // Signed after: rejected, and the caller learns why.
        (thumbprint, valid, gotReason) = issuers.keyAt(ORG_UIU, compromisedAt);
        assertEq(thumbprint, UIU_KEY_1, "thumbprint still returned so the verifier can explain");
        assertFalse(valid);
        assertEq(gotReason, reason);
    }

    function test_revokeKey_cannotExtendAnAlreadyClosedEpoch() public {
        uint64 rotateAt = uint64(block.timestamp) + 1 days;
        _govern(address(issuers), abi.encodeCall(IssuerRegistry.rotateKey, (ORG_UIU, UIU_KEY_2, rotateAt)));

        // Try to revoke epoch 0 with an effective time AFTER it already closed.
        // The window must not move forward — that would retroactively
        // re-validate signatures made with a superseded key.
        vm.warp(rotateAt + 10 days);
        _govern(
            address(issuers),
            abi.encodeCall(
                IssuerRegistry.revokeKey, (ORG_UIU, 0, bytes32("LATE"), rotateAt + 5 days)
            )
        );

        IssuerRegistry.KeyEpoch memory epoch = issuers.getEpoch(ORG_UIU, 0);
        assertEq(epoch.validUntil, rotateAt, "validUntil must not be extended");
    }

    function test_revokeKey_bringsWindowForward() public {
        uint64 rotateAt = uint64(block.timestamp) + 10 days;
        _govern(address(issuers), abi.encodeCall(IssuerRegistry.rotateKey, (ORG_UIU, UIU_KEY_2, rotateAt)));

        uint64 compromisedAt = uint64(block.timestamp) + 2 days;
        vm.warp(rotateAt + 1);
        _govern(
            address(issuers),
            abi.encodeCall(
                IssuerRegistry.revokeKey, (ORG_UIU, 0, bytes32("COMPROMISE"), compromisedAt)
            )
        );

        IssuerRegistry.KeyEpoch memory epoch = issuers.getEpoch(ORG_UIU, 0);
        assertEq(epoch.validUntil, compromisedAt);
        _assertKeyAt(compromisedAt - 1, UIU_KEY_1, true);
        _assertKeyAt(compromisedAt, UIU_KEY_1, false);
    }

    function test_revokeKey_rejectsEffectiveBeforeEpochStart() public {
        uint64 start = issuers.getEpoch(ORG_UIU, 0).validFrom;
        vm.prank(address(governance));
        vm.expectRevert(
            abi.encodeWithSelector(
                IssuerRegistry.EffectiveBeforeEpochStart.selector, start - 1, start
            )
        );
        issuers.revokeKey(ORG_UIU, 0, bytes32("X"), start - 1);
    }

    function test_revokeKey_rejectsZeroReasonAndBadEpoch() public {
        vm.startPrank(address(governance));
        vm.expectRevert(IssuerRegistry.ZeroReason.selector);
        issuers.revokeKey(ORG_UIU, 0, bytes32(0), 0);
        vm.expectRevert(IssuerRegistry.EpochOutOfRange.selector);
        issuers.revokeKey(ORG_UIU, 7, bytes32("X"), 0);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------
    // Status, accreditation, operators
    // ---------------------------------------------------------------

    function test_suspendingIssuerStopsItsOperatorWriting() public {
        assertTrue(issuers.isOperator(ORG_UIU, operator));
        _govern(
            address(issuers),
            abi.encodeCall(
                IssuerRegistry.setStatus, (ORG_UIU, IssuerRegistry.IssuerStatus.SUSPENDED)
            )
        );
        assertFalse(issuers.isActive(ORG_UIU));
        assertFalse(issuers.isOperator(ORG_UIU, operator), "suspension must bite immediately");
    }

    function test_suspensionDoesNotInvalidatePastKeys() public {
        uint64 signedAt = uint64(block.timestamp);
        _govern(
            address(issuers),
            abi.encodeCall(
                IssuerRegistry.setStatus, (ORG_UIU, IssuerRegistry.IssuerStatus.SUSPENDED)
            )
        );
        // Issuer status and key validity are separate questions; a verifier is
        // told both and decides. Suspension must not rewrite signing history.
        _assertKeyAt(signedAt, UIU_KEY_1, true);
    }

    function test_setOperator_revokes() public {
        _govern(address(issuers), abi.encodeCall(IssuerRegistry.setOperator, (ORG_UIU, operator, false)));
        assertFalse(issuers.isOperator(ORG_UIU, operator));
    }

    function test_setAccreditationAndDidWeb() public {
        _govern(
            address(issuers),
            abi.encodeCall(
                IssuerRegistry.setAccreditation, (ORG_UIU, IssuerRegistry.Accreditation.BOARD)
            )
        );
        assertEq(
            uint8(issuers.getIssuer(ORG_UIU).accreditation),
            uint8(IssuerRegistry.Accreditation.BOARD)
        );

        _govern(address(issuers), abi.encodeCall(IssuerRegistry.setDidWeb, (ORG_UIU, "did:web:new")));
        assertEq(issuers.getIssuer(ORG_UIU).didWeb, "did:web:new");

        vm.prank(address(governance));
        vm.expectRevert(IssuerRegistry.EmptyDid.selector);
        issuers.setDidWeb(ORG_UIU, "");
    }

    function test_orgIdsAreEnumerableForTheRegistrySnapshot() public view {
        bytes32[] memory ids = issuers.orgIds();
        assertEq(ids.length, 1);
        assertEq(ids[0], ORG_UIU);
        assertEq(issuers.orgCount(), 1);
    }

    function test_epochAt() public {
        uint64 rotateAt = uint64(block.timestamp) + 1 days;
        _govern(address(issuers), abi.encodeCall(IssuerRegistry.rotateKey, (ORG_UIU, UIU_KEY_2, rotateAt)));

        (uint16 epoch, bool found) = issuers.epochAt(ORG_UIU, rotateAt - 1);
        assertTrue(found);
        assertEq(epoch, 0);

        (epoch, found) = issuers.epochAt(ORG_UIU, rotateAt);
        assertTrue(found);
        assertEq(epoch, 1);

        (, found) = issuers.epochAt(keccak256("org.nobody"), rotateAt);
        assertFalse(found);
    }

    function test_getEpochsReturnsFullHistory() public {
        _govern(
            address(issuers),
            abi.encodeCall(IssuerRegistry.rotateKey, (ORG_UIU, UIU_KEY_2, uint64(block.timestamp) + 1))
        );
        IssuerRegistry.KeyEpoch[] memory epochs = issuers.getEpochs(ORG_UIU);
        assertEq(epochs.length, 2);
        assertEq(epochs[0].jwkThumbprint, UIU_KEY_1);
        assertEq(epochs[1].jwkThumbprint, UIU_KEY_2);

        vm.expectRevert(IssuerRegistry.EpochOutOfRange.selector);
        issuers.getEpoch(ORG_UIU, 9);
    }

    // ---------------------------------------------------------------
    // Fuzz — keyAt across rotation boundaries (PLAN §11)
    // ---------------------------------------------------------------

    function testFuzz_keyAt_alwaysResolvesToTheCoveringEpoch(uint64 gap1, uint64 gap2, uint64 probe)
        public
    {
        gap1 = uint64(bound(gap1, 1, 3650 days));
        gap2 = uint64(bound(gap2, 1, 3650 days));

        uint64 t0 = issuers.getEpoch(ORG_UIU, 0).validFrom;
        uint64 t1 = t0 + gap1;
        uint64 t2 = t1 + gap2;

        _govern(address(issuers), abi.encodeCall(IssuerRegistry.rotateKey, (ORG_UIU, UIU_KEY_2, t1)));
        _govern(address(issuers), abi.encodeCall(IssuerRegistry.rotateKey, (ORG_UIU, UIU_KEY_3, t2)));

        probe = uint64(bound(probe, t0, t2 + 3650 days));
        (bytes32 thumbprint, bool valid,) = issuers.keyAt(ORG_UIU, probe);

        bytes32 expected = probe < t1 ? UIU_KEY_1 : (probe < t2 ? UIU_KEY_2 : UIU_KEY_3);
        assertEq(thumbprint, expected, "keyAt picked the wrong epoch");
        assertTrue(valid, "an un-revoked epoch must always be valid inside its window");
    }

    function testFuzz_keyAt_neverValidBeforeTheFirstEpoch(uint64 probe) public view {
        uint64 start = issuers.getEpoch(ORG_UIU, 0).validFrom;
        probe = uint64(bound(probe, 0, start - 1));
        (, bool valid,) = issuers.keyAt(ORG_UIU, probe);
        assertFalse(valid);
    }

    function testFuzz_revokedEpochSplitsAtExactlyTheEffectiveInstant(uint64 offset, uint64 probe)
        public
    {
        uint64 start = issuers.getEpoch(ORG_UIU, 0).validFrom;
        offset = uint64(bound(offset, 1, 3650 days));
        uint64 effectiveFrom = start + offset;

        vm.warp(uint256(effectiveFrom) + 1);
        _govern(
            address(issuers),
            abi.encodeCall(
                IssuerRegistry.revokeKey, (ORG_UIU, 0, bytes32("COMPROMISE"), effectiveFrom)
            )
        );

        probe = uint64(bound(probe, start, effectiveFrom + 3650 days));
        (, bool valid,) = issuers.keyAt(ORG_UIU, probe);
        assertEq(valid, probe < effectiveFrom, "the compromise window must be exact");
    }

    function _assertKeyAt(uint64 timestamp, bytes32 expectedKey, bool expectedValid) private view {
        (bytes32 thumbprint, bool valid,) = issuers.keyAt(ORG_UIU, timestamp);
        assertEq(thumbprint, expectedKey);
        assertEq(valid, expectedValid);
    }
}
