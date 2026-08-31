const { Presentation, Credential, CredentialType, VerificationEvent, Organization } = require("../models");
const reconciliationService = require("../services/reconciliation.service");
const blockchainService = require("../services/blockchain.service");
const { getSigner } = require("../config/blockchain");

// GET /verifier/presentations/:token
async function getPresentation(req, res) {
  const { token } = req.params;
  const presentation = await Presentation.findOne({ where: { share_token: token } });
  if (!presentation) return res.status(404).json({ error: "Presentation not found" });
  if (new Date() > presentation.expires_at) return res.status(410).json({ error: "Presentation link expired" });

  const credentials = await Credential.findAll({
    where: { id: presentation.credential_ids },
    include: [CredentialType, { model: Organization, as: "issuer" }]
  });

  return res.json({ presentation, credentials });
}

// POST /verifier/verify   body: { share_token }
async function verifyPresentation(req, res) {
  try {
    const { share_token } = req.body;
    const presentation = await Presentation.findOne({ where: { share_token } });
    if (!presentation) return res.status(404).json({ error: "Presentation not found" });

    const credentials = await Credential.findAll({ where: { id: presentation.credential_ids } });

    let overallResult = "VALID";
    const details = [];

    for (const credential of credentials) {
      const { status } = await reconciliationService.reconcileCredentialStatus(credential);
      details.push({ credential_id: credential.id, liveStatus: status });
      if (status !== "ACTIVE") overallResult = status === "SUSPENDED" ? "REVOKED" : status; // map suspended->treated as not valid for verifier purposes
    }

    if (new Date() > presentation.expires_at) overallResult = "EXPIRED";

    presentation.verifier_org_id = req.user.organization_id;
    await presentation.save();

    // Record presentation receipt on-chain via ConsentAudit contract.
    // In the prototype the backend relays this using the admin signer.
    let onchainReceiptTx = null;
    try {
      const adminSigner = getSigner("ADMIN_PRIVATE_KEY");
      const result = await blockchainService.recordPresentationReceipt({
        verifierSigner: adminSigner,
        consentHash: presentation.consent_hash,
        result: overallResult === "VALID"
      });
      onchainReceiptTx = result.txHash;
    } catch (chainErr) {
      console.warn("On-chain receipt recording failed (non-fatal):", chainErr.message);
    }

    const event = await VerificationEvent.create({
      presentation_id: presentation.id,
      verifier_org_id: req.user.organization_id,
      verifier_user_id: req.user.id,
      result: overallResult,
      onchain_receipt_tx: onchainReceiptTx
    });

    return res.json({ result: overallResult, details, event });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getPresentation, verifyPresentation };
