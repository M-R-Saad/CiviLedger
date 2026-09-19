// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IssuerRegistry} from "./IssuerRegistry.sol";

/// @title StatusRegistry
/// @notice Anchors the hash and version of each W3C Bitstring Status List.
///         PLAN.html §6 job 2, §9.
/// @dev A centralised status service can un-revoke a credential, or serve one
///      answer to one verifier and a different answer to another. Recording the
///      list hash with a strictly increasing version makes both detectable: a
///      verifier compares the hash of what it downloaded against this contract,
///      and refuses any version below the highest it has already seen.
///
///      One transaction here covers 131,072 credentials. Nothing per-credential
///      is ever written, so nothing on this contract identifies anyone.
contract StatusRegistry {
    struct StatusList {
        bytes32 listHash;
        string uri;
        uint64 version;
        uint64 updatedAt;
        bool exists;
    }

    IssuerRegistry public immutable issuerRegistry;

    /// @dev orgId => listId => list.
    mapping(bytes32 => mapping(uint32 => StatusList)) private _lists;

    event StatusListPublished(
        bytes32 indexed orgId,
        uint32 indexed listId,
        bytes32 listHash,
        uint64 version,
        uint64 publishedAt
    );

    error NotOperator();
    error VersionNotIncreasing(uint64 submitted, uint64 stored);
    error ZeroHash();
    error EmptyUri();
    error UnknownList();

    constructor(address issuerRegistry_) {
        issuerRegistry = IssuerRegistry(issuerRegistry_);
    }

    /// @notice Publish a new version of a status list.
    /// @dev Reverts if `version` does not strictly exceed what is stored. There
    ///      is deliberately no path that lowers a version or overwrites a hash
    ///      at the same version — silent rollback is the attack this contract
    ///      exists to prevent.
    function publishStatusList(
        bytes32 orgId,
        uint32 listId,
        bytes32 listHash,
        string calldata uri,
        uint64 version
    ) external {
        if (!issuerRegistry.isOperator(orgId, msg.sender)) revert NotOperator();
        if (listHash == bytes32(0)) revert ZeroHash();
        if (bytes(uri).length == 0) revert EmptyUri();

        StatusList storage list = _lists[orgId][listId];
        if (version <= list.version) revert VersionNotIncreasing(version, list.version);

        list.listHash = listHash;
        list.uri = uri;
        list.version = version;
        list.updatedAt = uint64(block.timestamp);
        list.exists = true;

        emit StatusListPublished(orgId, listId, listHash, version, list.updatedAt);
    }

    function getStatusList(bytes32 orgId, uint32 listId)
        external
        view
        returns (bytes32 listHash, string memory uri, uint64 version, uint64 updatedAt)
    {
        StatusList storage list = _lists[orgId][listId];
        if (!list.exists) revert UnknownList();
        return (list.listHash, list.uri, list.version, list.updatedAt);
    }

    function exists(bytes32 orgId, uint32 listId) external view returns (bool) {
        return _lists[orgId][listId].exists;
    }
}
