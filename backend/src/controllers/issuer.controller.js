const { Credential, CredentialType, CredentialStatusEvent, User } = require("../models");
const hashingService = require("../services/hashing.service");
const blockchainService = require("../services/blockchain.service");

// POST /issuer/credentials
async function issueCredential(req, res) {
  try {
    const { credential_type_code, citizen_wallet_address, citizen_user_id, payload, expires_at } = req.body;

    const credentialType = await CredentialType.findOne({ where: { code: credential_type_code } });
    if (!credentialType) return res.status(400).json({ error: "Unknown credential_type_code" });

    // Auto-lookup citizen by wallet address if citizen_user_id not provided
    let resolvedCitizenUserId = citizen_user_id;
    if (!resolvedCitizenUserId && citizen_wallet_address) {
      const citizen = await User.findOne({ where: { wallet_address: citizen_wallet_address } });
      if (!citizen) return res.status(400).json({ error: `No citizen found with wallet address ${citizen_wallet_address}. The citizen must register first.` });
      resolvedCitizenUserId = citizen.id;
    }
    if (!resolvedCitizenUserId) return res.status(400).json({ error: "citizen_user_id or citizen_wallet_address is required" });

    const payloadHash = hashingService.hashPayload(payload);

    // 1. Anchor on-chain first
    const { txHash, anchorId } = await blockchainService.issueAnchor({
      credentialTypeCode: credential_type_code,
      payloadHash,
      citizenAddress: citizen_wallet_address,
      expiresAt: expires_at ? Math.floor(new Date(expires_at).getTime() / 1000) : 0
    });

    // 2. Then persist the full payload off-chain, linked to the anchor
    const credential = await Credential.create({
      credential_type_id: credentialType.id,
      issuer_org_id: req.user.organization_id,
      citizen_user_id: resolvedCitizenUserId,
      payload,
      payload_hash: payloadHash,
      onchain_anchor_id: anchorId,
      issued_at: new Date(),
      expires_at: expires_at || null,
      status_cache: "ACTIVE"
    });

    const { GovernanceEvent } = require("../models");
    await GovernanceEvent.create({
      event_type: "CREDENTIAL_ISSUED",
      organization_id: req.user.organization_id,
      actor_user_id: req.user.id,
      details: { credential_id: credential.id, credential_type_code },
      onchain_tx_hash: txHash
    });

    return res.status(201).json({ credential, onchain: { txHash, anchorId } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /issuer/credentials — list what this issuer org has issued
async function listIssuedCredentials(req, res) {
  const credentials = await Credential.findAll({ where: { issuer_org_id: req.user.organization_id } });
  res.json(credentials);
}

// POST /issuer/credentials/:id/status  { action: 'SUSPEND' | 'REACTIVATE' | 'REVOKE', reason }
async function changeCredentialStatus(req, res) {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;

    const credential = await Credential.findByPk(id, { include: [CredentialType] });
    if (!credential) return res.status(404).json({ error: "Credential not found" });

    const previousStatus = credential.status_cache;

    const { txHash } = await blockchainService.changeStatus({
      credentialTypeCode: credential.CredentialType.code,
      anchorId: credential.onchain_anchor_id,
      action,
      reason
    });

    const newStatus = { SUSPEND: "SUSPENDED", REACTIVATE: "ACTIVE", REVOKE: "REVOKED" }[action];
    credential.status_cache = newStatus;
    await credential.save();

    await CredentialStatusEvent.create({
      credential_id: credential.id,
      previous_status: previousStatus,
      new_status: newStatus,
      reason,
      actor_user_id: req.user.id,
      onchain_tx_hash: txHash
    });

    return res.json({ credential, onchain: { txHash } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /issuer/stats — aggregate counts for the issuer dashboard
async function getIssuerStats(req, res) {
  try {
    const { Op } = require("sequelize");
    const where = { issuer_org_id: req.user.organization_id };
    const [total, active, suspended, revoked] = await Promise.all([
      Credential.count({ where }),
      Credential.count({ where: { ...where, status_cache: "ACTIVE" } }),
      Credential.count({ where: { ...where, status_cache: "SUSPENDED" } }),
      Credential.count({ where: { ...where, status_cache: "REVOKED" } }),
    ]);
    const recentActivity = await CredentialStatusEvent.findAll({
      include: [{ model: Credential, where }],
      order: [["created_at", "DESC"]],
      limit: 5,
    });
    res.json({ total, active, suspended, revoked, recentActivity });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /issuer/credentials/:id — full detail for a single credential
async function getCredentialDetail(req, res) {
  try {
    const credential = await Credential.findByPk(req.params.id, {
      include: [
        CredentialType,
        { model: User, as: "citizen", attributes: ["id", "full_name", "wallet_address", "did"] },
        { model: CredentialStatusEvent, order: [["created_at", "DESC"]] }
      ]
    });
    if (!credential) return res.status(404).json({ error: "Credential not found" });
    if (credential.issuer_org_id !== req.user.organization_id) {
      return res.status(403).json({ error: "Not your credential" });
    }
    res.json(credential);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { issueCredential, listIssuedCredentials, changeCredentialStatus, getIssuerStats, getCredentialDetail };
