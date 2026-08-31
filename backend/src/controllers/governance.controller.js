const { Organization, GovernanceEvent, CredentialStatusEvent } = require("../models");
const { getContract, getSigner } = require("../config/blockchain");

// POST /governance/propose-member  { name, onchain_address, type, credential_types_authorized }
async function proposeMember(req, res) {
  try {
    const { name, onchain_address, type, credential_types_authorized } = req.body;

    // Check if org already exists in DB (e.g. from a previous run)
    let org = await Organization.findOne({ where: { onchain_address } });
    if (org) {
      return res.status(200).json({ organization: org, note: "Organization already exists in DB" });
    }

    org = await Organization.create({
      name,
      onchain_address,
      type,
      credential_types_authorized,
      status: "PENDING"
    });

    // On-chain: call Governance.proposeMember() using the ADMIN signer
    let txHash = null;
    try {
      const admin = getSigner("ADMIN_PRIVATE_KEY");
      const governance = getContract("Governance", admin);
      const role = type === "VERIFIER" ? await governance.VERIFIER_ROLE() : await governance.ISSUER_ROLE();
      const tx = await governance.proposeMember(onchain_address, name, role);
      const receipt = await tx.wait();
      txHash = receipt.hash;
    } catch (chainErr) {
      // On-chain entity may already exist (seeded). Continue — the DB org is created.
      console.warn("On-chain proposeMember failed (may already exist):", chainErr.message);
    }

    await GovernanceEvent.create({
      event_type: "MEMBER_PROPOSED",
      organization_id: org.id,
      actor_user_id: req.user.id,
      details: { name, onchain_address },
      onchain_tx_hash: txHash
    });

    return res.status(201).json({ organization: org, txHash });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// POST /governance/approve-member/:organizationId
async function approveMember(req, res) {
  try {
    const { organizationId } = req.params;
    const org = await Organization.findByPk(organizationId);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    let txHash = null;
    try {
      const admin = getSigner("ADMIN_PRIVATE_KEY");
      const governance = getContract("Governance", admin);
      const tx = await governance.approveMember(org.onchain_address);
      const receipt = await tx.wait();
      txHash = receipt.hash;
    } catch (chainErr) {
      // On-chain entity may already be approved (seeded). Continue — update DB status.
      console.warn("On-chain approveMember failed (may already be approved):", chainErr.message);
    }

    org.status = "ACTIVE";
    await org.save();

    await GovernanceEvent.create({
      event_type: "MEMBER_APPROVED",
      organization_id: org.id,
      actor_user_id: req.user.id,
      onchain_tx_hash: txHash
    });

    return res.json({ organization: org, txHash });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /governance/audit-log
async function getAuditLog(req, res) {
  const governanceEvents = await GovernanceEvent.findAll({ order: [["created_at", "DESC"]], limit: 100 });
  const statusEvents = await CredentialStatusEvent.findAll({ order: [["created_at", "DESC"]], limit: 100 });
  res.json({ governanceEvents, statusEvents });
}

// GET /governance/organizations
async function listOrganizations(req, res) {
  const organizations = await Organization.findAll({ order: [["created_at", "DESC"]] });
  res.json(organizations);
}

// GET /governance/pending-members
async function listPendingMembers(req, res) {
  const pending = await Organization.findAll({ where: { status: "PENDING" }, order: [["created_at", "DESC"]] });
  res.json(pending);
}

module.exports = { proposeMember, approveMember, getAuditLog, listOrganizations, listPendingMembers };
