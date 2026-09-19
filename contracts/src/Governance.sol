// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title Governance
/// @notice Roles and M-of-N approval for the consortium. PLAN.html §11.
/// @dev No value transfer, no token, no `transfer` function. This contract only
///      decides who may write to the registries, and requires that admissions
///      and key rotations be approved by administrators from distinct
///      organisations — one organisation must never be able to admit an issuer
///      or rotate another issuer's key alone (PLAN §17, insider-forgery row).
///
///      Nothing here takes or emits a string. Organisations are referred to by
///      `bytes32 orgId` throughout, and no parameter carries personal data.
contract Governance is AccessControl {
    /// @notice May propose and approve governed actions.
    bytes32 public constant ADMIN_ROLE = keccak256("civiledger.role.admin");
    /// @notice Held by an issuing institution's service account.
    bytes32 public constant ISSUER_ROLE = keccak256("civiledger.role.issuer");
    /// @notice The anchor worker: publishes status lists, batch and audit roots.
    bytes32 public constant ORACLE_ROLE = keccak256("civiledger.role.oracle");
    /// @notice Read-only oversight. Granted so the seat is externally visible.
    bytes32 public constant OVERSIGHT_ROLE = keccak256("civiledger.role.oversight");

    /// @notice How long an unexecuted proposal stays live.
    uint64 public constant PROPOSAL_TTL = 14 days;

    struct Proposal {
        address target;
        bytes32 payloadHash;
        uint64 proposedAt;
        uint64 executedAt;
        uint8 approvals;
        bool exists;
    }

    /// @dev Which organisation each admin represents. Approvals are counted per
    ///      distinct organisation, so three admin keys held by one university
    ///      still count as one approval.
    mapping(address => bytes32) public adminOrg;
    /// @dev orgId => number of admins currently registered to it.
    mapping(bytes32 => uint256) public adminsPerOrg;
    /// @dev How many distinct organisations hold at least one admin key.
    uint8 public organisationCount;

    mapping(bytes32 => Proposal) private _proposals;
    /// @dev actionId => orgId => approved. Keyed by organisation, not address.
    mapping(bytes32 => mapping(bytes32 => bool)) private _approvedByOrg;

    /// @notice Approvals required to execute a governed action.
    uint8 public threshold;

    event AdminEnrolled(address indexed admin, bytes32 indexed orgId);
    event AdminRemoved(address indexed admin, bytes32 indexed orgId);
    event ThresholdChanged(uint8 previousThreshold, uint8 newThreshold);
    event ActionProposed(
        bytes32 indexed actionId, address indexed target, bytes32 payloadHash, bytes32 indexed byOrg
    );
    event ActionApproved(bytes32 indexed actionId, bytes32 indexed byOrg, uint8 approvals);
    event ActionExecuted(bytes32 indexed actionId, address indexed target);
    event ActionCancelled(bytes32 indexed actionId);

    error NotAdmin();
    error UnknownAction();
    error AlreadyExecuted();
    error AlreadyApproved();
    error ThresholdNotMet(uint8 approvals, uint8 required);
    error ProposalExpired();
    error PayloadMismatch();
    error ThresholdTooHigh(uint8 requested, uint8 organisations);
    error ThresholdTooLow();
    error AdminAlreadyEnrolled();
    error AdminNotEnrolled();
    error ExecutionFailed();
    error ZeroOrg();

    modifier onlyAdmin() {
        if (!hasRole(ADMIN_ROLE, msg.sender)) revert NotAdmin();
        _;
    }

    /// @param initialAdmin The bootstrap administrator.
    /// @param initialAdminOrg The organisation that administrator represents.
    /// @dev Threshold starts at 1 because on day one there is one organisation.
    ///      PLAN §3 is explicit that we do not claim otherwise; raising it is a
    ///      governed action once node two and node three exist.
    constructor(address initialAdmin, bytes32 initialAdminOrg) {
        if (initialAdminOrg == bytes32(0)) revert ZeroOrg();
        _grantRole(DEFAULT_ADMIN_ROLE, address(this));
        _grantRole(ADMIN_ROLE, initialAdmin);
        _enrolAdmin(initialAdmin, initialAdminOrg);
        threshold = 1;
        emit ThresholdChanged(0, 1);
    }

    // ---------------------------------------------------------------
    // Administrators
    // ---------------------------------------------------------------

    /// @notice Enrol an administrator against an organisation. Governed action.
    function enrolAdmin(address admin, bytes32 orgId) external {
        _requireSelfCall();
        if (orgId == bytes32(0)) revert ZeroOrg();
        if (adminOrg[admin] != bytes32(0)) revert AdminAlreadyEnrolled();
        _grantRole(ADMIN_ROLE, admin);
        _enrolAdmin(admin, orgId);
    }

    /// @notice Remove an administrator. Governed action.
    /// @dev Lowers the threshold if removing this admin would otherwise make the
    ///      threshold unreachable and deadlock governance permanently.
    function removeAdmin(address admin) external {
        _requireSelfCall();
        bytes32 orgId = adminOrg[admin];
        if (orgId == bytes32(0)) revert AdminNotEnrolled();

        _revokeRole(ADMIN_ROLE, admin);
        delete adminOrg[admin];
        adminsPerOrg[orgId] -= 1;
        if (adminsPerOrg[orgId] == 0) {
            organisationCount -= 1;
            if (threshold > organisationCount) {
                uint8 previous = threshold;
                threshold = organisationCount == 0 ? 1 : organisationCount;
                emit ThresholdChanged(previous, threshold);
            }
        }
        emit AdminRemoved(admin, orgId);
    }

    function _enrolAdmin(address admin, bytes32 orgId) private {
        if (adminsPerOrg[orgId] == 0) organisationCount += 1;
        adminsPerOrg[orgId] += 1;
        adminOrg[admin] = orgId;
        emit AdminEnrolled(admin, orgId);
    }

    /// @notice Set the M-of-N approval threshold. Governed action.
    function setThreshold(uint8 m) external {
        _requireSelfCall();
        if (m == 0) revert ThresholdTooLow();
        if (m > organisationCount) revert ThresholdTooHigh(m, organisationCount);
        uint8 previous = threshold;
        threshold = m;
        emit ThresholdChanged(previous, m);
    }

    // ---------------------------------------------------------------
    // Operational roles
    // ---------------------------------------------------------------

    /// @notice Grant an operational role. Governed action.
    /// @dev ADMIN_ROLE is deliberately not grantable this way — use `enrolAdmin`,
    ///      which also records the organisation the approval count depends on.
    function grantOperationalRole(bytes32 role, address account) external {
        _requireSelfCall();
        if (role == ADMIN_ROLE || role == DEFAULT_ADMIN_ROLE) revert NotAdmin();
        _grantRole(role, account);
    }

    /// @notice Revoke an operational role. Governed action.
    function revokeOperationalRole(bytes32 role, address account) external {
        _requireSelfCall();
        if (role == ADMIN_ROLE || role == DEFAULT_ADMIN_ROLE) revert NotAdmin();
        _revokeRole(role, account);
    }

    // ---------------------------------------------------------------
    // M-of-N proposals
    // ---------------------------------------------------------------

    /// @notice Deterministic identifier for an action.
    function actionId(address target, bytes calldata payload) public pure returns (bytes32) {
        return keccak256(abi.encode(target, keccak256(payload)));
    }

    /// @notice Propose an action. Proposing counts as the proposer's approval.
    function proposeAction(address target, bytes calldata payload) external onlyAdmin returns (bytes32) {
        bytes32 id = actionId(target, payload);
        Proposal storage p = _proposals[id];
        bytes32 org = adminOrg[msg.sender];

        if (!p.exists) {
            p.exists = true;
            p.target = target;
            p.payloadHash = keccak256(payload);
            p.proposedAt = uint64(block.timestamp);
            emit ActionProposed(id, target, p.payloadHash, org);
        } else if (p.executedAt != 0) {
            revert AlreadyExecuted();
        }

        _approve(id, p, org);
        return id;
    }

    /// @notice Approve a pending action on behalf of the caller's organisation.
    function approveAction(bytes32 id) external onlyAdmin {
        Proposal storage p = _proposals[id];
        if (!p.exists) revert UnknownAction();
        if (p.executedAt != 0) revert AlreadyExecuted();
        _approve(id, p, adminOrg[msg.sender]);
    }

    function _approve(bytes32 id, Proposal storage p, bytes32 org) private {
        if (block.timestamp > p.proposedAt + PROPOSAL_TTL) revert ProposalExpired();
        if (_approvedByOrg[id][org]) revert AlreadyApproved();
        _approvedByOrg[id][org] = true;
        p.approvals += 1;
        emit ActionApproved(id, org, p.approvals);
    }

    /// @notice Execute an approved action against its target.
    /// @dev The payload is supplied again and checked against the hash recorded
    ///      at proposal time, so approvers cannot be shown one action and have
    ///      another executed.
    function executeAction(address target, bytes calldata payload) external onlyAdmin {
        bytes32 id = actionId(target, payload);
        Proposal storage p = _proposals[id];
        if (!p.exists) revert UnknownAction();
        if (p.executedAt != 0) revert AlreadyExecuted();
        if (block.timestamp > p.proposedAt + PROPOSAL_TTL) revert ProposalExpired();
        if (p.payloadHash != keccak256(payload)) revert PayloadMismatch();
        if (p.approvals < threshold) revert ThresholdNotMet(p.approvals, threshold);

        p.executedAt = uint64(block.timestamp);
        emit ActionExecuted(id, target);

        (bool ok,) = target.call(payload);
        if (!ok) revert ExecutionFailed();
    }

    /// @notice Withdraw a proposal that has not executed.
    function cancelAction(bytes32 id) external onlyAdmin {
        Proposal storage p = _proposals[id];
        if (!p.exists) revert UnknownAction();
        if (p.executedAt != 0) revert AlreadyExecuted();
        delete _proposals[id];
        emit ActionCancelled(id);
    }

    function getProposal(bytes32 id) external view returns (Proposal memory) {
        return _proposals[id];
    }

    function hasApproved(bytes32 id, bytes32 orgId) external view returns (bool) {
        return _approvedByOrg[id][orgId];
    }

    /// @dev Governed calls arrive as a self-call from `executeAction`.
    function _requireSelfCall() private view {
        if (msg.sender != address(this)) revert NotAdmin();
    }
}
