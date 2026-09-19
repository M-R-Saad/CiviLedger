// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Governance} from "../src/Governance.sol";
import {IssuerRegistry} from "../src/IssuerRegistry.sol";
import {StatusRegistry} from "../src/StatusRegistry.sol";
import {AnchorRegistry} from "../src/AnchorRegistry.sol";
import {AuditAnchor} from "../src/AuditAnchor.sol";

/// @dev Shared fixture. Deploys the consortium as it exists after bootstrap:
///      three admin organisations, one registered issuer, one anchor worker.
abstract contract BaseTest is Test {
    Governance internal governance;
    IssuerRegistry internal issuers;
    StatusRegistry internal statuses;
    AnchorRegistry internal anchors;
    AuditAnchor internal audit;

    bytes32 internal constant ORG_CIVILEDGER = keccak256("org.civiledger");
    bytes32 internal constant ORG_UIU = keccak256("org.uiu");
    bytes32 internal constant ORG_INDEPENDENT = keccak256("org.independent");

    address internal adminCiviledger = makeAddr("admin.civiledger");
    address internal adminUiu = makeAddr("admin.uiu");
    address internal adminIndependent = makeAddr("admin.independent");
    address internal operator = makeAddr("operator.uiu");
    address internal oracle = makeAddr("anchor-worker");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant UIU_KEY_1 = keccak256("uiu.key.1");
    bytes32 internal constant UIU_KEY_2 = keccak256("uiu.key.2");
    bytes32 internal constant UIU_KEY_3 = keccak256("uiu.key.3");

    function setUp() public virtual {
        // Start well past the epoch so `validFrom` arithmetic never underflows.
        vm.warp(1_800_000_000);

        governance = new Governance(adminCiviledger, ORG_CIVILEDGER);
        issuers = new IssuerRegistry(address(governance));
        statuses = new StatusRegistry(address(issuers));
        anchors = new AnchorRegistry(address(issuers));
        audit = new AuditAnchor(address(governance));

        // Threshold is 1 while CiviLedger is the only admin organisation.
        _govern(address(governance), abi.encodeCall(Governance.enrolAdmin, (adminUiu, ORG_UIU)));
        _govern(
            address(governance),
            abi.encodeCall(Governance.enrolAdmin, (adminIndependent, ORG_INDEPENDENT))
        );
        _govern(
            address(governance),
            abi.encodeCall(Governance.grantOperationalRole, (governance.ORACLE_ROLE(), oracle))
        );
    }

    /// @dev Execute a governed action, approving from as many organisations as
    ///      the current threshold requires.
    function _govern(address target, bytes memory payload) internal {
        // Resolve every view BEFORE pranking: `vm.prank` applies to the next
        // call, and an inline view call would consume it.
        uint8 threshold = governance.threshold();
        bytes32 id = governance.actionId(target, payload);

        vm.prank(adminCiviledger);
        governance.proposeAction(target, payload);

        if (threshold >= 2) {
            vm.prank(adminUiu);
            governance.approveAction(id);
        }
        if (threshold >= 3) {
            vm.prank(adminIndependent);
            governance.approveAction(id);
        }

        vm.prank(adminCiviledger);
        governance.executeAction(target, payload);
    }

    function _registerUiu() internal {
        _govern(
            address(issuers),
            abi.encodeCall(
                IssuerRegistry.registerIssuer,
                (
                    ORG_UIU,
                    "did:web:civiledger.com.bd:issuers:uiu",
                    IssuerRegistry.Accreditation.UGC_RECOGNIZED,
                    UIU_KEY_1,
                    0
                )
            )
        );
        _govern(address(issuers), abi.encodeCall(IssuerRegistry.setOperator, (ORG_UIU, operator, true)));
    }
}
