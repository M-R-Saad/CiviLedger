// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Governance.sol";

/// @title IssuerRegistry
/// @notice Tracks which on-chain addresses are recognized issuer organizations
/// (e.g. Identity Authority, Education Authority, Transport Authority) and
/// which credential types each one is authorized to issue.
contract IssuerRegistry {
    Governance public governance;

    enum IssuerStatus {
        NONE,
        ACTIVE,
        SUSPENDED
    }

    struct Issuer {
        string name;
        IssuerStatus status;
        string[] authorizedCredentialTypes; // e.g. ["IDENTITY"], ["ACADEMIC_DEGREE"]
    }

    mapping(address => Issuer) private issuers;
    address[] public issuerAddresses;

    event IssuerRegistered(address indexed issuer, string name);
    event IssuerStatusUpdated(address indexed issuer, IssuerStatus status);
    event IssuerKeyRotated(address indexed oldAddress, address indexed newAddress);

    modifier onlyAdmin() {
        require(governance.hasRole(governance.ADMIN_ROLE(), msg.sender), "IssuerRegistry: caller is not ADMIN");
        _;
    }

    constructor(address governanceAddress) {
        governance = Governance(governanceAddress);
    }

    /// @notice Register a new issuer organization (must already hold ISSUER_ROLE in Governance).
    function registerIssuer(
        address issuerAddress,
        string calldata name,
        string[] calldata credentialTypes
    ) external onlyAdmin {
        require(governance.hasRole(governance.ISSUER_ROLE(), issuerAddress), "IssuerRegistry: not ISSUER_ROLE");
        require(issuers[issuerAddress].status == IssuerStatus.NONE, "IssuerRegistry: already registered");

        issuers[issuerAddress] = Issuer({ name: name, status: IssuerStatus.ACTIVE, authorizedCredentialTypes: credentialTypes });
        issuerAddresses.push(issuerAddress);

        emit IssuerRegistered(issuerAddress, name);
    }

    function updateIssuerStatus(address issuerAddress, IssuerStatus status) external onlyAdmin {
        require(issuers[issuerAddress].status != IssuerStatus.NONE, "IssuerRegistry: unknown issuer");
        issuers[issuerAddress].status = status;
        emit IssuerStatusUpdated(issuerAddress, status);
    }

    /// @notice Move an issuer's registration to a new address (e.g. after a key compromise).
    function rotateIssuerKey(address oldAddress, address newAddress) external onlyAdmin {
        require(issuers[oldAddress].status != IssuerStatus.NONE, "IssuerRegistry: unknown issuer");
        require(issuers[newAddress].status == IssuerStatus.NONE, "IssuerRegistry: new address in use");

        issuers[newAddress] = issuers[oldAddress];
        delete issuers[oldAddress];
        issuerAddresses.push(newAddress);

        emit IssuerKeyRotated(oldAddress, newAddress);
    }

    function getIssuer(address issuerAddress) external view returns (Issuer memory) {
        return issuers[issuerAddress];
    }

    function isActiveIssuer(address issuerAddress) external view returns (bool) {
        return issuers[issuerAddress].status == IssuerStatus.ACTIVE;
    }
}
