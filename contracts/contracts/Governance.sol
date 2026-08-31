// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title Governance
/// @notice Central role registry for the CiviLedger consortium.
/// Defines ADMIN, ISSUER, VERIFIER and OVERSIGHT roles and a simple
/// propose/approve flow for admitting new member organizations.
/// Other contracts (IssuerRegistry, CredentialRegistry, CredentialStatus,
/// ConsentAudit) should check roles against this contract.
contract Governance is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant OVERSIGHT_ROLE = keccak256("OVERSIGHT_ROLE");

    enum MemberStatus {
        NONE,
        PROPOSED,
        APPROVED,
        SUSPENDED,
        OFFBOARDED
    }

    struct Member {
        string name;
        MemberStatus status;
        bytes32 role; // ISSUER_ROLE or VERIFIER_ROLE
    }

    mapping(address => Member) public members;
    address[] public memberAddresses;

    event MemberProposed(address indexed account, string name, bytes32 role);
    event MemberApproved(address indexed account, bytes32 role);
    event MemberSuspended(address indexed account);
    event MemberOffboarded(address indexed account);
    event PolicyUpdated(string key, string value);

    constructor(address initialAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(ADMIN_ROLE, initialAdmin);
    }

    /// @notice Propose a new organization for membership (issuer or verifier).
    function proposeMember(address account, string calldata name, bytes32 role) external onlyRole(ADMIN_ROLE) {
        require(account != address(0), "Governance: zero address");
        require(role == ISSUER_ROLE || role == VERIFIER_ROLE, "Governance: invalid role");
        require(members[account].status == MemberStatus.NONE, "Governance: already exists");

        members[account] = Member({ name: name, status: MemberStatus.PROPOSED, role: role });
        memberAddresses.push(account);

        emit MemberProposed(account, name, role);
    }

    /// @notice Approve a previously proposed member, granting it the on-chain role.
    function approveMember(address account) external onlyRole(ADMIN_ROLE) {
        Member storage m = members[account];
        require(m.status == MemberStatus.PROPOSED, "Governance: not proposed");

        m.status = MemberStatus.APPROVED;
        _grantRole(m.role, account);

        emit MemberApproved(account, m.role);
    }

    /// @notice Temporarily suspend a member's role without removing its history.
    function suspendMember(address account) external onlyRole(ADMIN_ROLE) {
        Member storage m = members[account];
        require(m.status == MemberStatus.APPROVED, "Governance: not an approved member");

        m.status = MemberStatus.SUSPENDED;
        _revokeRole(m.role, account);

        emit MemberSuspended(account);
    }

    /// @notice Permanently remove a member from the consortium.
    function offboardMember(address account) external onlyRole(ADMIN_ROLE) {
        Member storage m = members[account];
        require(
            m.status == MemberStatus.APPROVED || m.status == MemberStatus.SUSPENDED,
            "Governance: cannot offboard"
        );

        if (hasRole(m.role, account)) {
            _revokeRole(m.role, account);
        }
        m.status = MemberStatus.OFFBOARDED;

        emit MemberOffboarded(account);
    }

    /// @notice Grant the OVERSIGHT (read-only auditor) role.
    function grantOversight(address account) external onlyRole(ADMIN_ROLE) {
        _grantRole(OVERSIGHT_ROLE, account);
    }

    /// @notice Emit an informational policy-update event (off-chain indexers pick this up).
    function updatePolicy(string calldata key, string calldata value) external onlyRole(ADMIN_ROLE) {
        emit PolicyUpdated(key, value);
    }

    function getMember(address account) external view returns (Member memory) {
        return members[account];
    }

    function totalMembers() external view returns (uint256) {
        return memberAddresses.length;
    }
}
