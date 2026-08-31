// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ConsentAudit
/// @notice Append-only log of citizen consent events (sharing a presentation) and
/// verifier receipt events (confirming they checked a presentation). Used to build
/// the citizen's "who saw what, when" audit trail and the oversight audit log.
contract ConsentAudit {
    struct ConsentRecord {
        address citizen;
        bytes32 consentHash; // hash of (credential IDs shared + recipient + timestamp), signed off-chain by citizen
        uint256 timestamp;
    }

    struct PresentationReceipt {
        address verifier;
        bytes32 consentHash; // links back to the ConsentRecord this receipt is for
        bool result; // true = verified valid, false = invalid/revoked/expired
        uint256 timestamp;
    }

    ConsentRecord[] private consentRecords;
    PresentationReceipt[] private receipts;

    mapping(address => uint256[]) private citizenConsentIndexes;
    mapping(bytes32 => uint256[]) private consentHashReceiptIndexes;

    event ConsentRecorded(address indexed citizen, bytes32 indexed consentHash, uint256 timestamp);
    event PresentationReceiptRecorded(address indexed verifier, bytes32 indexed consentHash, bool result, uint256 timestamp);

    /// @notice Citizen (or the backend acting on their signed request) records that consent was given to share credentials.
    function recordConsentHash(bytes32 consentHash) external returns (uint256 recordIndex) {
        consentRecords.push(ConsentRecord({ citizen: msg.sender, consentHash: consentHash, timestamp: block.timestamp }));
        recordIndex = consentRecords.length - 1;
        citizenConsentIndexes[msg.sender].push(recordIndex);

        emit ConsentRecorded(msg.sender, consentHash, block.timestamp);
    }

    /// @notice Verifier records that they checked a presentation tied to a given consent hash.
    function recordPresentationReceipt(bytes32 consentHash, bool result) external returns (uint256 receiptIndex) {
        receipts.push(PresentationReceipt({ verifier: msg.sender, consentHash: consentHash, result: result, timestamp: block.timestamp }));
        receiptIndex = receipts.length - 1;
        consentHashReceiptIndexes[consentHash].push(receiptIndex);

        emit PresentationReceiptRecorded(msg.sender, consentHash, result, block.timestamp);
    }

    /// @notice Returns all consent record indexes for a citizen (fetch details via consentRecords(i) if made public, or via events off-chain).
    function queryCitizenAudit(address citizen) external view returns (uint256[] memory) {
        return citizenConsentIndexes[citizen];
    }

    function getConsentRecord(uint256 index) external view returns (ConsentRecord memory) {
        return consentRecords[index];
    }

    function getReceiptsForConsent(bytes32 consentHash) external view returns (uint256[] memory) {
        return consentHashReceiptIndexes[consentHash];
    }

    function getReceipt(uint256 index) external view returns (PresentationReceipt memory) {
        return receipts[index];
    }
}
