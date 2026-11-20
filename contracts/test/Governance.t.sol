// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./Base.t.sol";
import {Governance} from "../src/Governance.sol";
import {IssuerRegistry} from "../src/IssuerRegistry.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

/// @dev The property that matters: one organisation must never be able to admit
///      an issuer or rotate another issuer's key alone (PLAN §11, §17).
contract GovernanceTest is BaseTest {
    bytes internal registerPayload;

    function setUp() public override {
        super.setUp();
        registerPayload = abi.encodeCall(
            IssuerRegistry.registerIssuer,
            (
                ORG_UIU,
                "did:web:civiledger.com.bd:issuers:uiu",
                IssuerRegistry.Accreditation.UGC_RECOGNIZED,
                UIU_KEY_1,
                0
            )
        );
    }

    function test_bootstrapState() public view {
        assertEq(governance.threshold(), 1);
        assertEq(governance.organisationCount(), 3);
        assertEq(governance.adminOrg(adminCiviledger), ORG_CIVILEDGER);
        assertTrue(governance.hasRole(governance.ADMIN_ROLE(), adminUiu));
        assertTrue(governance.hasRole(governance.ORACLE_ROLE(), oracle));
    }

    function test_oneOrganisationCannotActAloneAtThresholdThree() public {
        _raiseThreshold(3);

        vm.prank(adminCiviledger);
        governance.proposeAction(address(issuers), registerPayload);

        // Proposing counts as one approval. Two organisations are still missing.
        vm.prank(adminCiviledger);
        vm.expectRevert(abi.encodeWithSelector(Governance.ThresholdNotMet.selector, 1, 3));
        governance.executeAction(address(issuers), registerPayload);

        assertFalse(issuers.getIssuer(ORG_UIU).exists);
    }

    function test_severalKeysFromOneOrganisationCountOnce() public {
        address secondUiuAdmin = makeAddr("admin.uiu.2");
        _govern(
            address(governance),
            abi.encodeCall(Governance.enrolAdmin, (secondUiuAdmin, ORG_UIU))
        );
        assertEq(governance.organisationCount(), 3, "a second key adds no new organisation");

        _raiseThreshold(2);

        bytes32 id = governance.actionId(address(issuers), registerPayload);

        vm.prank(adminUiu);
        governance.proposeAction(address(issuers), registerPayload);

        // A second key held by the SAME university must not satisfy the second
        // approval — otherwise M-of-N is theatre.
        vm.prank(secondUiuAdmin);
        vm.expectRevert(Governance.AlreadyApproved.selector);
        governance.approveAction(id);

        vm.prank(adminCiviledger);
        governance.approveAction(id);
        vm.prank(adminUiu);
        governance.executeAction(address(issuers), registerPayload);
        assertTrue(issuers.getIssuer(ORG_UIU).exists);
    }

    function test_executeRunsTheApprovedPayloadOnly() public {
        vm.prank(adminCiviledger);
        governance.proposeAction(address(issuers), registerPayload);

        bytes memory swapped = abi.encodeCall(
            IssuerRegistry.registerIssuer,
            (
                keccak256("org.attacker"),
                "did:web:attacker",
                IssuerRegistry.Accreditation.UGC_RECOGNIZED,
                UIU_KEY_1,
                0
            )
        );
        // A different payload is a different action, so it has no approvals.
        vm.prank(adminCiviledger);
        vm.expectRevert(Governance.UnknownAction.selector);
        governance.executeAction(address(issuers), swapped);
    }

    function test_cannotExecuteTwice() public {
        _govern(address(issuers), registerPayload);
        vm.prank(adminCiviledger);
        vm.expectRevert(Governance.AlreadyExecuted.selector);
        governance.executeAction(address(issuers), registerPayload);
    }

    function test_proposalExpires() public {
        vm.prank(adminCiviledger);
        governance.proposeAction(address(issuers), registerPayload);

        vm.warp(block.timestamp + governance.PROPOSAL_TTL() + 1);
        vm.prank(adminCiviledger);
        vm.expectRevert(Governance.ProposalExpired.selector);
        governance.executeAction(address(issuers), registerPayload);
    }

    function test_approvalAfterExpiryIsRejected() public {
        _raiseThreshold(2);
        vm.prank(adminCiviledger);
        governance.proposeAction(address(issuers), registerPayload);

        bytes32 id = governance.actionId(address(issuers), registerPayload);
        vm.warp(block.timestamp + governance.PROPOSAL_TTL() + 1);
        vm.prank(adminUiu);
        vm.expectRevert(Governance.ProposalExpired.selector);
        governance.approveAction(id);
    }

    function test_nonAdminCannotPropose() public {
        vm.prank(stranger);
        vm.expectRevert(Governance.NotAdmin.selector);
        governance.proposeAction(address(issuers), registerPayload);
    }

    function test_governedFunctionsRejectDirectCalls() public {
        // Every governed entry point must reject anything that is not a
        // self-call from executeAction — including a sitting administrator.
        bytes32 oracleRole = governance.ORACLE_ROLE();
        vm.startPrank(adminCiviledger);
        vm.expectRevert(Governance.NotAdmin.selector);
        governance.enrolAdmin(stranger, keccak256("org.x"));
        vm.expectRevert(Governance.NotAdmin.selector);
        governance.setThreshold(1);
        vm.expectRevert(Governance.NotAdmin.selector);
        governance.grantOperationalRole(oracleRole, stranger);
        vm.expectRevert(Governance.NotAdmin.selector);
        governance.removeAdmin(adminUiu);
        vm.expectRevert(Governance.NotAdmin.selector);
        governance.revokeOperationalRole(oracleRole, oracle);
        vm.stopPrank();
    }

    function test_adminRoleIsNotGrantableAsAnOperationalRole() public {
        bytes32 adminRole = governance.ADMIN_ROLE();
        bytes32 defaultAdminRole = governance.DEFAULT_ADMIN_ROLE();
        vm.startPrank(address(governance));
        vm.expectRevert(Governance.NotAdmin.selector);
        governance.grantOperationalRole(adminRole, stranger);
        vm.expectRevert(Governance.NotAdmin.selector);
        governance.grantOperationalRole(defaultAdminRole, stranger);
        vm.expectRevert(Governance.NotAdmin.selector);
        governance.revokeOperationalRole(adminRole, adminUiu);
        vm.stopPrank();
    }

    function test_openZeppelinDirectGrantIsClosed() public {
        // DEFAULT_ADMIN_ROLE is held by the contract itself, so no human can
        // bypass the proposal flow through AccessControl's own API.
        bytes32 defaultAdminRole = governance.DEFAULT_ADMIN_ROLE();
        bytes32 adminRole = governance.ADMIN_ROLE();
        assertTrue(governance.hasRole(defaultAdminRole, address(governance)));
        vm.prank(adminCiviledger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                adminCiviledger,
                defaultAdminRole
            )
        );
        governance.grantRole(adminRole, stranger);
    }

    function test_setThresholdRejectsImpossibleValues() public {
        vm.startPrank(address(governance));
        vm.expectRevert(Governance.ThresholdTooLow.selector);
        governance.setThreshold(0);
        vm.expectRevert(abi.encodeWithSelector(Governance.ThresholdTooHigh.selector, 4, 3));
        governance.setThreshold(4);
        vm.stopPrank();
    }

    function test_removingAnOrganisationLowersAnUnreachableThreshold() public {
        _raiseThreshold(3);
        _govern(address(governance), abi.encodeCall(Governance.removeAdmin, (adminIndependent)));

        // Threshold 3 with two organisations left would deadlock governance
        // permanently, so it is lowered as the organisation leaves.
        assertEq(governance.organisationCount(), 2);
        assertEq(governance.threshold(), 2);
        assertFalse(governance.hasRole(governance.ADMIN_ROLE(), adminIndependent));
        assertEq(governance.adminOrg(adminIndependent), bytes32(0));
    }

    function test_removeAdminRejectsUnknown() public {
        vm.prank(address(governance));
        vm.expectRevert(Governance.AdminNotEnrolled.selector);
        governance.removeAdmin(stranger);
    }

    function test_enrolAdminRejectsDuplicateAndZeroOrg() public {
        vm.startPrank(address(governance));
        vm.expectRevert(Governance.AdminAlreadyEnrolled.selector);
        governance.enrolAdmin(adminUiu, ORG_INDEPENDENT);
        vm.expectRevert(Governance.ZeroOrg.selector);
        governance.enrolAdmin(stranger, bytes32(0));
        vm.stopPrank();
    }

    function test_cancelAction() public {
        vm.prank(adminCiviledger);
        bytes32 id = governance.proposeAction(address(issuers), registerPayload);
        vm.prank(adminUiu);
        governance.cancelAction(id);

        vm.prank(adminCiviledger);
        vm.expectRevert(Governance.UnknownAction.selector);
        governance.executeAction(address(issuers), registerPayload);
    }

    function test_failedTargetCallRevertsTheExecution() public {
        // registerIssuer with a zero orgId reverts inside IssuerRegistry.
        bytes memory bad = abi.encodeCall(
            IssuerRegistry.registerIssuer,
            (bytes32(0), "did:web:x", IssuerRegistry.Accreditation.BOARD, UIU_KEY_1, 0)
        );
        vm.prank(adminCiviledger);
        governance.proposeAction(address(issuers), bad);
        vm.prank(adminCiviledger);
        vm.expectRevert(Governance.ExecutionFailed.selector);
        governance.executeAction(address(issuers), bad);
    }

    function test_approveUnknownAction() public {
        vm.prank(adminCiviledger);
        vm.expectRevert(Governance.UnknownAction.selector);
        governance.approveAction(keccak256("nope"));
    }

    function test_hasApprovedAndGetProposal() public {
        vm.prank(adminCiviledger);
        bytes32 id = governance.proposeAction(address(issuers), registerPayload);
        assertTrue(governance.hasApproved(id, ORG_CIVILEDGER));
        assertFalse(governance.hasApproved(id, ORG_UIU));

        Governance.Proposal memory p = governance.getProposal(id);
        assertEq(p.target, address(issuers));
        assertEq(p.approvals, 1);
        assertTrue(p.exists);
    }

    function test_constructorRejectsZeroOrg() public {
        vm.expectRevert(Governance.ZeroOrg.selector);
        new Governance(adminCiviledger, bytes32(0));
    }

    function _raiseThreshold(uint8 m) private {
        _govern(address(governance), abi.encodeCall(Governance.setThreshold, (m)));
        assertEq(governance.threshold(), m);
    }
}
