const { ethers } = require("ethers");
const { getContract, getSigner } = require("../config/blockchain");

/**
 * Thin wrapper around ethers.js contract calls so routes/controllers never touch
 * ethers directly. Swap the signer selection logic here if you move to real
 * per-organization keys held client-side instead of backend-held demo keys.
 */

// The signer is chosen by the acting *organisation*, not the credential type, so
// the on-chain issuer always matches the off-chain issuer_org_id. Maps the org's
// registered on-chain address to the key the backend signs with.
const ORG_ADDRESS_TO_ENV = {
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8": "IDENTITY_AUTHORITY_PRIVATE_KEY",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": "EDUCATION_AUTHORITY_PRIVATE_KEY",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906": "TRANSPORT_AUTHORITY_PRIVATE_KEY"
};

function issuerSignerForOrg(org) {
  if (!org || !org.onchain_address) {
    throw new Error("Organisation has no on-chain address configured");
  }
  let env = null;
  try {
    env = ORG_ADDRESS_TO_ENV[ethers.getAddress(org.onchain_address)];
  } catch {
    /* invalid address falls through to the throw below */
  }
  if (!env) throw new Error(`No signing key configured for organisation ${org.name || org.id}`);
  return getSigner(env);
}

async function issueAnchor({ issuerOrg, credentialTypeCode, payloadHash, citizenAddress, expiresAt }) {
  const signer = issuerSignerForOrg(issuerOrg);
  const contract = getContract("CredentialRegistry", signer);

  const tx = await contract.issueAnchor(payloadHash, citizenAddress, credentialTypeCode, expiresAt || 0);
  const receipt = await tx.wait();

  // Primary: read the anchor id off the emitted event.
  const event = receipt.logs
    .map((log) => { try { return contract.interface.parseLog(log); } catch { return null; } })
    .find((parsed) => parsed && parsed.name === "CredentialAnchored");
  let anchorId = event ? event.args.anchorId : null;

  // Fallback: CredentialRegistry derives the id as
  //   keccak256(abi.encodePacked(msg.sender, citizen, payloadHash, block.timestamp))
  // so recompute it from the mined block. Keeps issuance working if the deployed
  // ABI drifts from the contract and the event no longer parses.
  if (!anchorId) {
    const block = await signer.provider.getBlock(receipt.blockNumber);
    anchorId = ethers.solidityPackedKeccak256(
      ["address", "address", "bytes32", "uint256"],
      [await signer.getAddress(), citizenAddress, payloadHash, block.timestamp]
    );
  }

  return { txHash: receipt.hash, anchorId };
}

async function getStatus(anchorId) {
  const contract = getContract("CredentialStatus");
  const statusEnum = await contract.getStatus(anchorId);
  return ["ACTIVE", "SUSPENDED", "REVOKED"][Number(statusEnum)] || "UNKNOWN";
}

async function getAnchor(anchorId) {
  const contract = getContract("CredentialRegistry");
  return contract.getAnchor(anchorId);
}

// Combines the two IssuerRegistry reads the verifier flow needs.
async function getIssuerInfo(address) {
  const contract = getContract("IssuerRegistry");
  const [active, data] = await Promise.all([
    contract.isActiveIssuer(address),
    contract.getIssuer(address)
  ]);
  return { active: Boolean(active), name: data && data.name ? data.name : null };
}

async function changeStatus({ issuerOrg, anchorId, action, reason }) {
  const signer = issuerSignerForOrg(issuerOrg);
  const contract = getContract("CredentialStatus", signer);

  let tx;
  if (action === "SUSPEND") tx = await contract.suspend(anchorId, reason || "");
  else if (action === "REACTIVATE") tx = await contract.reactivate(anchorId, reason || "");
  else if (action === "REVOKE") tx = await contract.revoke(anchorId, reason || "");
  else throw new Error(`Unknown status action: ${action}`);

  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

async function recordConsent({ citizenSigner, consentHash }) {
  const contract = getContract("ConsentAudit", citizenSigner);
  const tx = await contract.recordConsentHash(consentHash);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

async function recordPresentationReceipt({ verifierSigner, consentHash, result }) {
  const contract = getContract("ConsentAudit", verifierSigner);
  const tx = await contract.recordPresentationReceipt(consentHash, result);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

module.exports = {
  issueAnchor,
  getStatus,
  getAnchor,
  getIssuerInfo,
  changeStatus,
  recordConsent,
  recordPresentationReceipt
};
