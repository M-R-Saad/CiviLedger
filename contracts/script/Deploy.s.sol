// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Governance} from "../src/Governance.sol";
import {IssuerRegistry} from "../src/IssuerRegistry.sol";
import {StatusRegistry} from "../src/StatusRegistry.sol";
import {AnchorRegistry} from "../src/AnchorRegistry.sol";
import {AuditAnchor} from "../src/AuditAnchor.sol";

/// @notice Deploy the five registries.
/// @dev Deliberately does NOT admit any issuer. Issuer admission is a governed
///      ceremony (PLAN §11, §12.1) and must not be a side effect of deployment —
///      otherwise the deployer key alone can mint a degree from any university,
///      which is the failure the whole design exists to prevent.
///
///      Usage:
///        forge script script/Deploy.s.sol:Deploy \
///          --rpc-url $BESU_RPC_URL --broadcast \
///          --sig "run(address,bytes32)" $ADMIN $ADMIN_ORG_ID
contract Deploy is Script {
    struct Deployment {
        address governance;
        address issuerRegistry;
        address statusRegistry;
        address anchorRegistry;
        address auditAnchor;
    }

    function run(address initialAdmin, bytes32 initialAdminOrg) external returns (Deployment memory d) {
        vm.startBroadcast();

        Governance governance = new Governance(initialAdmin, initialAdminOrg);
        IssuerRegistry issuerRegistry = new IssuerRegistry(address(governance));
        StatusRegistry statusRegistry = new StatusRegistry(address(issuerRegistry));
        AnchorRegistry anchorRegistry = new AnchorRegistry(address(issuerRegistry));
        AuditAnchor auditAnchor = new AuditAnchor(address(governance));

        vm.stopBroadcast();

        d = Deployment({
            governance: address(governance),
            issuerRegistry: address(issuerRegistry),
            statusRegistry: address(statusRegistry),
            anchorRegistry: address(anchorRegistry),
            auditAnchor: address(auditAnchor)
        });

        _write(d);
    }

    function _write(Deployment memory d) private {
        string memory json = "deployment";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeUint(json, "deployedAtBlock", block.number);
        vm.serializeAddress(json, "Governance", d.governance);
        vm.serializeAddress(json, "IssuerRegistry", d.issuerRegistry);
        vm.serializeAddress(json, "StatusRegistry", d.statusRegistry);
        vm.serializeAddress(json, "AnchorRegistry", d.anchorRegistry);
        string memory out = vm.serializeAddress(json, "AuditAnchor", d.auditAnchor);

        string memory path =
            string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(out, path);

        console.log("Governance      %s", d.governance);
        console.log("IssuerRegistry  %s", d.issuerRegistry);
        console.log("StatusRegistry  %s", d.statusRegistry);
        console.log("AnchorRegistry  %s", d.anchorRegistry);
        console.log("AuditAnchor     %s", d.auditAnchor);
        console.log("written to      %s", path);
    }
}
