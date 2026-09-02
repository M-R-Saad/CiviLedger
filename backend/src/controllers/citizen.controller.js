const { v4: uuidv4 } = require("uuid");
const { Credential, Presentation, CredentialType, Organization } = require("../models");
const qrcodeService = require("../services/qrcode.service");
const blockchainService = require("../services/blockchain.service");
const { getSigner } = require("../config/blockchain");
const { ethers } = require("ethers");

// GET /citizen/credentials
async function listMyCredentials(req, res) {
  const credentials = await Credential.findAll({
    where: { citizen_user_id: req.user.id },
    include: [CredentialType, { model: Organization, as: "issuer" }]
  });
  res.json(credentials);
}

// POST /citizen/presentations
// body: { credential_ids: [...], consent_signature, consent_hash }
// consent_signature/consent_hash are produced client-side via MetaMask (see frontend/src/hooks/useWallet.ts)
async function createPresentation(req, res) {
  try {
    const { credential_ids, consent_signature, consent_hash, expiry_minutes } = req.body;
    if (!credential_ids || !credential_ids.length) {
      return res.status(400).json({ error: "credential_ids is required" });
    }

    // Compute consent hash if not provided by the client
    const finalConsentHash = consent_hash || ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify({ credential_ids, citizen: req.user.id, ts: Date.now() }))
    );
    const finalConsentSignature = consent_signature || "backend-relayed";

    const shareToken = uuidv4().replace(/-/g, "");
    const expiryMs = (expiry_minutes || 15) * 60 * 1000;
    const expiresAt = new Date(Date.now() + expiryMs);

    const presentation = await Presentation.create({
      citizen_user_id: req.user.id,
      credential_ids,
      consent_signature: finalConsentSignature,
      consent_hash: finalConsentHash,
      share_token: shareToken,
      expires_at: expiresAt
    });

    // Record consent on-chain via ConsentAudit contract.
    // In the prototype the backend relays this using the admin signer.
    // In production the citizen would sign this tx themselves via MetaMask.
    let onchainConsentTx = null;
    try {
      const adminSigner = getSigner("ADMIN_PRIVATE_KEY");
      const result = await blockchainService.recordConsent({
        citizenSigner: adminSigner,
        consentHash: finalConsentHash
      });
      onchainConsentTx = result.txHash;
    } catch (chainErr) {
      console.warn("On-chain consent recording failed (non-fatal):", chainErr.message);
    }

    const qrDataUrl = await qrcodeService.generatePresentationQrDataUrl(shareToken, process.env.APP_BASE_URL || "http://localhost:5173");

    return res.status(201).json({ presentation, shareUrl: `/verify/${shareToken}`, qrDataUrl, onchainConsentTx });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /citizen/audit-history
async function getAuditHistory(req, res) {
  try {
    const { Presentation: PresentationModel, VerificationEvent, Organization: OrgModel } = require("../models");
    const presentations = await PresentationModel.findAll({
      where: { citizen_user_id: req.user.id },
      include: [
        { model: VerificationEvent },
        { model: OrgModel, as: "verifierOrg" }
      ],
      order: [["created_at", "DESC"]]
    });
    res.json(presentations);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /citizen/stats — aggregate counts for citizen wallet dashboard
async function getCitizenStats(req, res) {
  try {
    const totalCredentials = await Credential.count({ where: { citizen_user_id: req.user.id } });
    const activeCredentials = await Credential.count({ where: { citizen_user_id: req.user.id, status_cache: "ACTIVE" } });
    const { Presentation: PresentationModel } = require("../models");
    const totalShared = await PresentationModel.count({ where: { citizen_user_id: req.user.id } });
    const expiredCredentials = await Credential.count({
      where: {
        citizen_user_id: req.user.id,
        expires_at: { [require("sequelize").Op.lt]: new Date() }
      }
    });
    res.json({ totalCredentials, activeCredentials, expiredCredentials, totalShared });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /citizen/credentials/:id — full detail for citizen's own credential
async function getCredentialDetail(req, res) {
  try {
    const { CredentialStatusEvent } = require("../models");
    const credential = await Credential.findByPk(req.params.id, {
      include: [
        CredentialType,
        { model: Organization, as: "issuer" },
        { model: CredentialStatusEvent, order: [["created_at", "DESC"]] }
      ]
    });
    if (!credential) return res.status(404).json({ error: "Credential not found" });
    if (credential.citizen_user_id !== req.user.id) {
      return res.status(403).json({ error: "Not your credential" });
    }
    res.json(credential);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { listMyCredentials, createPresentation, getAuditHistory, getCitizenStats, getCredentialDetail };
