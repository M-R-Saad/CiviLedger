const { getContract, getSigner } = require("../config/blockchain");

/**
 * Thin wrapper around ethers.js contract calls so routes/controllers never touch
 * ethers directly. Swap the signer selection logic here if you move to real
 * per-organization keys held client-side instead of backend-held demo keys.
 */

function issuerSignerFor(organizationCode) {
  const envVarMap = {
    IDENTITY: "IDENTITY_AUTHORITY_PRIVATE_KEY",
    ACADEMIC_DEGREE: "EDUCATION_AUTHORITY_PRIVATE_KEY",
    DRIVING_LICENSE: "TRANSPORT_AUTHORITY_PRIVATE_KEY"
  };
  const envVar = envVarMap[organizationCode];
  if (!envVar) throw new Error(`No signer configured for credential type ${organizationCode}`);
  return getSigner(envVar);
}

async function issueAnchor({ credentialTypeCode, payloadHash, citizenAddress, expiresAt }) {
  const signer = issuerSignerFor(credentialTypeCode);
  const contract = getContract("CredentialRegistry", signer);

  const tx = await contract.issueAnchor(payloadHash, citizenAddress, credentialTypeCode, expiresAt || 0);
  const receipt = await tx.wait();

  const event = receipt.logs
    .map((log) => { try { return contract.interface.parseLog(log); } catch { return null; } })
    .find((parsed) => parsed && parsed.name === "CredentialAnchored");

  return { txHash: receipt.hash, anchorId: event ? event.args.anchorId : null };
}

async function getStatus(anchorId) {
  const contract = getContract("CredentialStatus");
  const statusEnum = await contract.getStatus(anchorId);
  return ["ACTIVE", "SUSPENDED", "REVOKED"][Number(statusEnum)];
}

async function changeStatus({ credentialTypeCode, anchorId, action, reason }) {
  const signer = issuerSignerFor(credentialTypeCode);
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

module.exports = { issueAnchor, getStatus, changeStatus, recordConsent, recordPresentationReceipt };
