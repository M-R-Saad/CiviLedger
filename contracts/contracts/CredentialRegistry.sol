// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IssuerRegistry.sol";

/// @title CredentialRegistry
/// @notice Anchors a hash of an off-chain credential payload on-chain, along with
/// minimal metadata (issuer, type, timestamps). Full credential content and personal
/// data are NEVER stored here — only in the off-chain database (see docs/02_database_schema.json).
contract CredentialRegistry {
    IssuerRegistry public issuerRegistry;

    struct Anchor {
        bytes32 payloadHash;
        address issuer;
        address citizen;
        string credentialType;
        uint256 issuedAt;
        uint256 expiresAt; // 0 = no expiry
        bool exists;
        bool superseded;
        bytes32 supersededBy;
    }

    // anchorId => Anchor
    mapping(bytes32 => Anchor) private anchors;

    event CredentialAnchored(
        bytes32 indexed anchorId,
        address indexed issuer,
        address indexed citizen,
        string credentialType,
        bytes32 payloadHash
    );
    event CredentialSuperseded(bytes32 indexed oldAnchorId, bytes32 indexed newAnchorId);

    modifier onlyActiveIssuer() {
        require(issuerRegistry.isActiveIssuer(msg.sender), "CredentialRegistry: caller is not an active issuer");
        _;
    }

    constructor(address issuerRegistryAddress) {
        issuerRegistry = IssuerRegistry(issuerRegistryAddress);
    }

    /// @notice Anchor a new credential. anchorId is derived deterministically so the
    /// backend can predict it before sending the transaction if needed.
    function issueAnchor(
        bytes32 payloadHash,
        address citizen,
        string calldata credentialType,
        uint256 expiresAt
    ) external onlyActiveIssuer returns (bytes32 anchorId) {
        require(citizen != address(0), "CredentialRegistry: zero citizen address");

        anchorId = keccak256(abi.encodePacked(msg.sender, citizen, payloadHash, block.timestamp));
        require(!anchors[anchorId].exists, "CredentialRegistry: anchor collision, retry");

        anchors[anchorId] = Anchor({
            payloadHash: payloadHash,
            issuer: msg.sender,
            citizen: citizen,
            credentialType: credentialType,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            exists: true,
            superseded: false,
            supersededBy: bytes32(0)
        });

        emit CredentialAnchored(anchorId, msg.sender, citizen, credentialType, payloadHash);
    }

    /// @notice Mark an old anchor as superseded by a new one (e.g. reissued after key rotation).
    function supersedeCredential(bytes32 oldAnchorId, bytes32 newAnchorId) external onlyActiveIssuer {
        Anchor storage oldAnchor = anchors[oldAnchorId];
        require(oldAnchor.exists, "CredentialRegistry: old anchor not found");
        require(oldAnchor.issuer == msg.sender, "CredentialRegistry: not original issuer");
        require(anchors[newAnchorId].exists, "CredentialRegistry: new anchor not found");

        oldAnchor.superseded = true;
        oldAnchor.supersededBy = newAnchorId;

        emit CredentialSuperseded(oldAnchorId, newAnchorId);
    }

    function getAnchor(bytes32 anchorId) external view returns (Anchor memory) {
        return anchors[anchorId];
    }

    /// @notice Verify that a given payload hash matches what was anchored, and hasn't expired/superseded.
    function verifyAnchor(bytes32 anchorId, bytes32 payloadHash) external view returns (bool isValid, string memory reason) {
        Anchor memory a = anchors[anchorId];
        if (!a.exists) return (false, "ANCHOR_NOT_FOUND");
        if (a.payloadHash != payloadHash) return (false, "HASH_MISMATCH");
        if (a.superseded) return (false, "SUPERSEDED");
        if (a.expiresAt != 0 && block.timestamp > a.expiresAt) return (false, "EXPIRED");
        return (true, "OK");
    }
}
