// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IssuerRegistry
/// @notice The mapping from institution to signing key. PLAN.html §6, job 1.
/// @dev This is the load-bearing contract. If CiviLedger Ltd. controlled this
///      mapping unilaterally, CiviLedger Ltd. could mint a degree from any
///      university and no verifier could tell. Every write therefore arrives
///      through Governance's M-of-N path, and every key epoch is append-only.
///
///      Key history is never destroyed. A credential signed in 2027 must still
///      verify in 2037 after three rotations, which is why `keyAt` takes a
///      timestamp rather than returning the current key (invariant §25).
///
///      Personal data: none. Organisations are `bytes32 orgId`; the only string
///      is `didWeb`, an institutional domain identifier, which is public by
///      design and is not personal data.
contract IssuerRegistry {
    enum Accreditation {
        SELF_ASSERTED,
        PROFESSIONAL_BODY,
        BOARD,
        UGC_RECOGNIZED
    }

    enum IssuerStatus {
        PENDING,
        ACTIVE,
        SUSPENDED,
        RETIRED
    }

    struct KeyEpoch {
        /// @dev RFC 7638 thumbprint of the public key.
        bytes32 jwkThumbprint;
        uint64 validFrom;
        /// @dev 0 while current; otherwise the instant the epoch stopped covering signatures.
        uint64 validUntil;
        /// @dev Non-zero when the epoch was cut short rather than rotated normally.
        bytes32 revocationReason;
    }

    struct Issuer {
        string didWeb;
        Accreditation accreditation;
        IssuerStatus status;
        bool exists;
    }

    address public immutable governance;

    mapping(bytes32 => Issuer) private _issuers;
    mapping(bytes32 => KeyEpoch[]) private _epochs;
    bytes32[] private _orgIds;

    /// @dev The service account allowed to publish this issuer's status lists
    ///      and batch anchors. An organisation address, never a citizen's.
    ///      Scoped per issuer so one compromised operator cannot publish on
    ///      another institution's behalf.
    mapping(bytes32 => mapping(address => bool)) private _operators;

    event IssuerRegistered(
        bytes32 indexed orgId, Accreditation accreditation, bytes32 firstKey, uint64 validFrom
    );
    event IssuerStatusChanged(bytes32 indexed orgId, IssuerStatus previous, IssuerStatus current);
    event AccreditationChanged(
        bytes32 indexed orgId, Accreditation previous, Accreditation current
    );
    event KeyRotated(
        bytes32 indexed orgId, uint16 indexed epoch, bytes32 newKey, uint64 validFrom
    );
    event KeyRevoked(
        bytes32 indexed orgId, uint16 indexed epoch, bytes32 reason, uint64 effectiveFrom
    );
    event DidWebChanged(bytes32 indexed orgId);
    event OperatorSet(bytes32 indexed orgId, address indexed operator, bool allowed);

    error NotGovernance();
    error IssuerExists();
    error UnknownIssuer();
    error ZeroOrg();
    error ZeroKey();
    error EmptyDid();
    error EpochOutOfRange();
    error ValidFromNotIncreasing(uint64 requested, uint64 currentEpochStart);
    error EpochAlreadyClosed();
    error ZeroReason();
    error EffectiveBeforeEpochStart(uint64 effectiveFrom, uint64 validFrom);
    error TooManyEpochs();

    modifier onlyGovernance() {
        if (msg.sender != governance) revert NotGovernance();
        _;
    }

    constructor(address governance_) {
        governance = governance_;
    }

    // ---------------------------------------------------------------
    // Governed writes
    // ---------------------------------------------------------------

    /// @notice Admit an issuer with its first signing key.
    /// @param validFrom When the first key becomes valid. Pass 0 for "now".
    function registerIssuer(
        bytes32 orgId,
        string calldata didWeb,
        Accreditation accreditation,
        bytes32 firstKey,
        uint64 validFrom
    ) external onlyGovernance {
        if (orgId == bytes32(0)) revert ZeroOrg();
        if (firstKey == bytes32(0)) revert ZeroKey();
        if (bytes(didWeb).length == 0) revert EmptyDid();
        if (_issuers[orgId].exists) revert IssuerExists();

        uint64 from = validFrom == 0 ? uint64(block.timestamp) : validFrom;

        _issuers[orgId] =
            Issuer({didWeb: didWeb, accreditation: accreditation, status: IssuerStatus.ACTIVE, exists: true});
        _epochs[orgId].push(
            KeyEpoch({jwkThumbprint: firstKey, validFrom: from, validUntil: 0, revocationReason: bytes32(0)})
        );
        _orgIds.push(orgId);

        emit IssuerRegistered(orgId, accreditation, firstKey, from);
        emit IssuerStatusChanged(orgId, IssuerStatus.PENDING, IssuerStatus.ACTIVE);
    }

    /// @notice Close the current epoch and open a new one.
    /// @dev `validFrom` may be in the future: rotation is a scheduled ceremony
    ///      with two people present (PLAN §12.1), and the transaction is sent
    ///      before the new key goes live. Signatures made before `validFrom`
    ///      keep resolving to the old epoch, which is the whole point.
    function rotateKey(bytes32 orgId, bytes32 newKey, uint64 validFrom) external onlyGovernance {
        if (newKey == bytes32(0)) revert ZeroKey();
        KeyEpoch[] storage epochs = _requireEpochs(orgId);
        if (epochs.length >= type(uint16).max) revert TooManyEpochs();

        KeyEpoch storage current = epochs[epochs.length - 1];
        uint64 from = validFrom == 0 ? uint64(block.timestamp) : validFrom;
        // Epochs must not overlap, or `keyAt` would be ambiguous.
        if (from <= current.validFrom) revert ValidFromNotIncreasing(from, current.validFrom);
        if (current.validUntil != 0) revert EpochAlreadyClosed();

        current.validUntil = from;
        epochs.push(
            KeyEpoch({jwkThumbprint: newKey, validFrom: from, validUntil: 0, revocationReason: bytes32(0)})
        );

        emit KeyRotated(orgId, uint16(epochs.length - 1), newKey, from);
    }

    /// @notice Cut an epoch short after a key compromise.
    /// @param effectiveFrom The instant the key stopped being trustworthy.
    ///        Credentials signed before this remain valid — PLAN §12.1, and the
    ///        reason `keyAt` takes a timestamp at all.
    /// @dev PLAN §11 sketches `revokeKey(orgId, epoch, reason)`. The effective
    ///      timestamp is added here because §12.1 requires it; see
    ///      docs/decisions/0002-key-revocation-effective-timestamp.md.
    function revokeKey(bytes32 orgId, uint16 epoch, bytes32 reason, uint64 effectiveFrom)
        external
        onlyGovernance
    {
        if (reason == bytes32(0)) revert ZeroReason();
        KeyEpoch[] storage epochs = _requireEpochs(orgId);
        if (epoch >= epochs.length) revert EpochOutOfRange();

        KeyEpoch storage target = epochs[epoch];
        uint64 from = effectiveFrom == 0 ? uint64(block.timestamp) : effectiveFrom;
        if (from < target.validFrom) revert EffectiveBeforeEpochStart(from, target.validFrom);

        // A revocation may bring an already-closed epoch's end forward, but must
        // never extend it — that would retroactively re-validate signatures.
        if (target.validUntil == 0 || from < target.validUntil) {
            target.validUntil = from;
        }
        target.revocationReason = reason;

        emit KeyRevoked(orgId, epoch, reason, target.validUntil);
    }

    function setStatus(bytes32 orgId, IssuerStatus status) external onlyGovernance {
        Issuer storage issuer = _requireIssuer(orgId);
        IssuerStatus previous = issuer.status;
        issuer.status = status;
        emit IssuerStatusChanged(orgId, previous, status);
    }

    function setAccreditation(bytes32 orgId, Accreditation accreditation) external onlyGovernance {
        Issuer storage issuer = _requireIssuer(orgId);
        Accreditation previous = issuer.accreditation;
        issuer.accreditation = accreditation;
        emit AccreditationChanged(orgId, previous, accreditation);
    }

    function setDidWeb(bytes32 orgId, string calldata didWeb) external onlyGovernance {
        if (bytes(didWeb).length == 0) revert EmptyDid();
        _requireIssuer(orgId).didWeb = didWeb;
        emit DidWebChanged(orgId);
    }

    /// @notice Authorise (or revoke) a service account to publish for this issuer.
    function setOperator(bytes32 orgId, address operator, bool allowed) external onlyGovernance {
        _requireIssuer(orgId);
        _operators[orgId][operator] = allowed;
        emit OperatorSet(orgId, operator, allowed);
    }

    // ---------------------------------------------------------------
    // Reads — this is what verifiers actually call
    // ---------------------------------------------------------------

    /// @notice Resolve the signing key that was in force at `timestamp`.
    /// @return thumbprint The key epoch covering (or last preceding) `timestamp`.
    /// @return valid Whether that key was actually valid at `timestamp`.
    /// @return reason Non-zero when the covering epoch was revoked.
    /// @dev Returns the thumbprint even when `valid` is false so a verifier can
    ///      tell "signed with a key we know, after it was revoked" apart from
    ///      "signed with a key we have never seen".
    function keyAt(bytes32 orgId, uint64 timestamp)
        external
        view
        returns (bytes32 thumbprint, bool valid, bytes32 reason)
    {
        KeyEpoch[] storage epochs = _epochs[orgId];
        uint256 count = epochs.length;
        if (count == 0) return (bytes32(0), false, bytes32(0));

        // No epoch had started yet.
        if (timestamp < epochs[0].validFrom) return (bytes32(0), false, bytes32(0));

        // Binary search for the last epoch whose validFrom <= timestamp.
        uint256 low = 0;
        uint256 high = count - 1;
        while (low < high) {
            uint256 mid = (low + high + 1) / 2;
            if (epochs[mid].validFrom <= timestamp) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }

        KeyEpoch storage covering = epochs[low];
        bool withinWindow = covering.validUntil == 0 || timestamp < covering.validUntil;
        return (covering.jwkThumbprint, withinWindow, covering.revocationReason);
    }

    /// @notice Index of the epoch covering (or last preceding) `timestamp`.
    function epochAt(bytes32 orgId, uint64 timestamp) external view returns (uint16 epoch, bool found) {
        KeyEpoch[] storage epochs = _epochs[orgId];
        uint256 count = epochs.length;
        if (count == 0 || timestamp < epochs[0].validFrom) return (0, false);

        uint256 low = 0;
        uint256 high = count - 1;
        while (low < high) {
            uint256 mid = (low + high + 1) / 2;
            if (epochs[mid].validFrom <= timestamp) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }
        // casting to 'uint16' is safe because rotateKey reverts with
        // TooManyEpochs before the array can reach type(uint16).max entries.
        // forge-lint: disable-next-line(unsafe-typecast)
        return (uint16(low), true);
    }

    function getIssuer(bytes32 orgId) external view returns (Issuer memory) {
        return _issuers[orgId];
    }

    function isActive(bytes32 orgId) public view returns (bool) {
        return _issuers[orgId].exists && _issuers[orgId].status == IssuerStatus.ACTIVE;
    }

    /// @notice May `operator` publish on behalf of `orgId` right now?
    /// @dev Suspending an issuer immediately stops its operator writing, which
    ///      is what makes suspension worth anything.
    function isOperator(bytes32 orgId, address operator) external view returns (bool) {
        return isActive(orgId) && _operators[orgId][operator];
    }

    function epochCount(bytes32 orgId) external view returns (uint256) {
        return _epochs[orgId].length;
    }

    function getEpoch(bytes32 orgId, uint16 epoch) external view returns (KeyEpoch memory) {
        KeyEpoch[] storage epochs = _epochs[orgId];
        if (epoch >= epochs.length) revert EpochOutOfRange();
        return epochs[epoch];
    }

    function getEpochs(bytes32 orgId) external view returns (KeyEpoch[] memory) {
        return _epochs[orgId];
    }

    /// @notice Every registered orgId, for building the public registry snapshot.
    function orgIds() external view returns (bytes32[] memory) {
        return _orgIds;
    }

    function orgCount() external view returns (uint256) {
        return _orgIds.length;
    }

    function _requireIssuer(bytes32 orgId) private view returns (Issuer storage) {
        Issuer storage issuer = _issuers[orgId];
        if (!issuer.exists) revert UnknownIssuer();
        return issuer;
    }

    function _requireEpochs(bytes32 orgId) private view returns (KeyEpoch[] storage) {
        if (!_issuers[orgId].exists) revert UnknownIssuer();
        return _epochs[orgId];
    }
}
