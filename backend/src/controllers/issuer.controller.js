const { ethers } = require("ethers");
const {
  sequelize,
  Credential,
  CredentialType,
  CredentialStatusEvent,
  GovernanceEvent,
  Organization,
  User
} = require("../models");
const hashingService = require("../services/hashing.service");
const blockchainService = require("../services/blockchain.service");
const { serverError, parseBody } = require("../utils/http");
const S = require("../schemas");

// Case-insensitive lookup so a differently-cased (but valid) address still matches.
function findUserByAddress(address) {
  return User.findOne({
    where: sequelize.where(
      sequelize.fn("lower", sequelize.col("wallet_address")),
      address.toLowerCase()
    )
  });
}

// POST /issuer/credentials
async function issueCredential(req, res) {
  const data = parseBody(res, S.issueCredential, req.body);
  if (!data) return;

  try {
    const credentialType = await CredentialType.findOne({ where: { code: data.credential_type_code } });
    if (!credentialType) return res.status(400).json({ error: "Unknown credential type." });

    // The acting organisation, and whether it may issue this type.
    const org = await Organization.findByPk(req.user.organization_id);
    if (!org) return res.status(400).json({ error: "Your account is not linked to an organisation." });
    const authorizedTypes = Array.isArray(org.credential_types_authorized) ? org.credential_types_authorized : [];
    if (!authorizedTypes.includes(data.credential_type_code)) {
      return res.status(403).json({
        error: `Your organisation is not authorised to issue ${credentialType.display_name || data.credential_type_code}.`
      });
    }

    // Resolve the citizen and a checksummed on-chain address.
    let citizenAddress = null;
    if (data.citizen_wallet_address) {
      try {
        citizenAddress = ethers.getAddress(data.citizen_wallet_address);
      } catch {
        return res.status(400).json({ error: "That is not a valid Ethereum wallet address." });
      }
    }

    let resolvedCitizenUserId = data.citizen_user_id;
    if (!resolvedCitizenUserId) {
      const citizen = await findUserByAddress(citizenAddress);
      if (!citizen) {
        return res.status(400).json({ error: `No citizen is registered with wallet address ${citizenAddress}.` });
      }
      resolvedCitizenUserId = citizen.id;
    }

    if (!citizenAddress) {
      const citizen = await User.findByPk(resolvedCitizenUserId);
      if (!citizen || !citizen.wallet_address) {
        return res.status(400).json({ error: "This citizen has no wallet address on file." });
      }
      try {
        citizenAddress = ethers.getAddress(citizen.wallet_address);
      } catch {
        return res.status(400).json({ error: "This citizen's stored wallet address is invalid. An admin needs to correct it." });
      }
    }

    const payloadHash = hashingService.hashPayload(data.payload);

    // 1. Anchor on-chain, signed by this organisation.
    const { txHash, anchorId } = await blockchainService.issueAnchor({
      issuerOrg: org,
      credentialTypeCode: data.credential_type_code,
      payloadHash,
      citizenAddress,
      expiresAt: data.expires_at ? Math.floor(new Date(data.expires_at).getTime() / 1000) : 0
    });

    if (!anchorId) {
      return res.status(502).json({
        error: "On-chain anchoring did not return an anchor id, so the credential was not saved. Check the chain service and that the contract ABIs are in sync."
      });
    }

    // 2. Persist the payload and the audit event together.
    let credential;
    try {
      credential = await sequelize.transaction(async (t) => {
        const c = await Credential.create(
          {
            credential_type_id: credentialType.id,
            issuer_org_id: org.id,
            citizen_user_id: resolvedCitizenUserId,
            payload: data.payload,
            payload_hash: payloadHash,
            onchain_anchor_id: anchorId,
            issued_at: new Date(),
            expires_at: data.expires_at || null,
            status_cache: "ACTIVE"
          },
          { transaction: t }
        );
        await GovernanceEvent.create(
          {
            event_type: "CREDENTIAL_ISSUED",
            organization_id: org.id,
            actor_user_id: req.user.id,
            details: { credential_id: c.id, credential_type_code: data.credential_type_code },
            onchain_tx_hash: txHash
          },
          { transaction: t }
        );
        return c;
      });
    } catch (dbErr) {
      // The anchor is already on-chain; log enough to reconcile it later.
      console.error(
        `[issuer.issueCredential] DB write failed after on-chain anchor ${anchorId} (tx ${txHash})`,
        dbErr
      );
      return serverError(res, "issuer.issueCredential", dbErr);
    }

    return res.status(201).json({ credential, onchain: { txHash, anchorId } });
  } catch (err) {
    return serverError(res, "issuer.issueCredential", err);
  }
}

// GET /issuer/credentials — list what this issuer org has issued
async function listIssuedCredentials(req, res) {
  try {
    const credentials = await Credential.findAll({ where: { issuer_org_id: req.user.organization_id } });
    res.json(credentials);
  } catch (err) {
    return serverError(res, "issuer.listIssuedCredentials", err);
  }
}

// POST /issuer/credentials/:id/status  { action, reason }
async function changeCredentialStatus(req, res) {
  const data = parseBody(res, S.changeStatus, req.body);
  if (!data) return;

  try {
    const { id } = req.params;
    const credential = await Credential.findByPk(id, { include: [CredentialType] });
    if (!credential) return res.status(404).json({ error: "Credential not found." });

    if (credential.issuer_org_id !== req.user.organization_id) {
      return res.status(403).json({ error: "This credential was not issued by your organisation." });
    }
    if (!credential.onchain_anchor_id) {
      return res.status(409).json({
        error: "This credential has no on-chain anchor, so its status cannot be changed on-chain. It was likely issued while the blockchain was unreachable. Re-issue it."
      });
    }

    const org = await Organization.findByPk(req.user.organization_id);
    const previousStatus = credential.status_cache;

    const { txHash } = await blockchainService.changeStatus({
      issuerOrg: org,
      anchorId: credential.onchain_anchor_id,
      action: data.action,
      reason: data.reason
    });

    const newStatus = { SUSPEND: "SUSPENDED", REACTIVATE: "ACTIVE", REVOKE: "REVOKED" }[data.action];
    credential.status_cache = newStatus;
    await credential.save();

    await CredentialStatusEvent.create({
      credential_id: credential.id,
      previous_status: previousStatus,
      new_status: newStatus,
      reason: data.reason,
      actor_user_id: req.user.id,
      onchain_tx_hash: txHash
    });

    return res.json({ credential, onchain: { txHash } });
  } catch (err) {
    return serverError(res, "issuer.changeCredentialStatus", err);
  }
}

// GET /issuer/stats — aggregate counts for the issuer dashboard
async function getIssuerStats(req, res) {
  try {
    const where = { issuer_org_id: req.user.organization_id };
    const [total, active, suspended, revoked] = await Promise.all([
      Credential.count({ where }),
      Credential.count({ where: { ...where, status_cache: "ACTIVE" } }),
      Credential.count({ where: { ...where, status_cache: "SUSPENDED" } }),
      Credential.count({ where: { ...where, status_cache: "REVOKED" } })
    ]);
    const recentActivity = await CredentialStatusEvent.findAll({
      include: [{ model: Credential, where }],
      order: [["created_at", "DESC"]],
      limit: 5
    });
    res.json({ total, active, suspended, revoked, recentActivity });
  } catch (err) {
    return serverError(res, "issuer.getIssuerStats", err);
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
    if (!credential) return res.status(404).json({ error: "Credential not found." });
    if (credential.issuer_org_id !== req.user.organization_id) {
      return res.status(403).json({ error: "Not your credential." });
    }
    res.json(credential);
  } catch (err) {
    return serverError(res, "issuer.getCredentialDetail", err);
  }
}

module.exports = {
  issueCredential,
  listIssuedCredentials,
  changeCredentialStatus,
  getIssuerStats,
  getCredentialDetail
};
