// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CredentialRegistry.sol";

/// @title CredentialStatus
/// @notice Tracks the current lifecycle status (Active/Suspended/Revoked) of each
/// anchored credential. Kept as a separate contract from CredentialRegistry so status
/// changes are cheap and clearly auditable via events, independent of the anchor data.
contract CredentialStatus {
    CredentialRegistry public credentialRegistry;

    enum Status {
        ACTIVE,
        SUSPENDED,
        REVOKED
    }

    // anchorId => status (defaults to ACTIVE the moment an anchor exists)
    mapping(bytes32 => Status) private statuses;
    mapping(bytes32 => bool) private initialized;

    event StatusChanged(bytes32 indexed anchorId, Status previousStatus, Status newStatus, string reason);

    modifier onlyIssuerOf(bytes32 anchorId) {
        CredentialRegistry.Anchor memory a = credentialRegistry.getAnchor(anchorId);
        require(a.exists, "CredentialStatus: anchor not found");
        require(a.issuer == msg.sender, "CredentialStatus: caller is not the issuer");
        _;
    }

    constructor(address credentialRegistryAddress) {
        credentialRegistry = CredentialRegistry(credentialRegistryAddress);
    }

    function _currentStatus(bytes32 anchorId) internal view returns (Status) {
        return initialized[anchorId] ? statuses[anchorId] : Status.ACTIVE;
    }

    function suspend(bytes32 anchorId, string calldata reason) external onlyIssuerOf(anchorId) {
        Status previous = _currentStatus(anchorId);
        require(previous == Status.ACTIVE, "CredentialStatus: only ACTIVE can be suspended");
        statuses[anchorId] = Status.SUSPENDED;
        initialized[anchorId] = true;
        emit StatusChanged(anchorId, previous, Status.SUSPENDED, reason);
    }

    function reactivate(bytes32 anchorId, string calldata reason) external onlyIssuerOf(anchorId) {
        Status previous = _currentStatus(anchorId);
        require(previous == Status.SUSPENDED, "CredentialStatus: only SUSPENDED can be reactivated");
        statuses[anchorId] = Status.ACTIVE;
        emit StatusChanged(anchorId, previous, Status.ACTIVE, reason);
    }

    function revoke(bytes32 anchorId, string calldata reason) external onlyIssuerOf(anchorId) {
        Status previous = _currentStatus(anchorId);
        require(previous != Status.REVOKED, "CredentialStatus: already revoked");
        statuses[anchorId] = Status.REVOKED;
        initialized[anchorId] = true;
        emit StatusChanged(anchorId, previous, Status.REVOKED, reason);
    }

    function getStatus(bytes32 anchorId) external view returns (Status) {
        return _currentStatus(anchorId);
    }
}
