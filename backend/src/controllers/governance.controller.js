const { Organization, GovernanceEvent, CredentialStatusEvent } = require("../models");
const { getContract, getSigner } = require("../config/blockchain");
const { serverError, parseBody } = require("../utils/http");
const S = require("../schemas");

// POST /governance/propose-member
async function proposeMember(req, res) {
  const data = parseBody(res, S.proposeMember, req.body);
  if (!data) return;

  try {
    const { name, onchain_address, type, credential_types_authorized } = data;

    let org = await Organization.findOne({ where: { onchain_address } });
    if (org) {
      return res.status(200).json({ organization: org, note: "Organisation already exists" });
    }

    org = await Organization.create({
      name,
      onchain_address,
      type,
      credential_types_authorized,
      status: "PENDING"
    });

    let txHash = null;
    try {
      const admin = getSigner("ADMIN_PRIVATE_KEY");
      const governance = getContract("Governance", admin);
      const role = type === "VERIFIER" ? await governance.VERIFIER_ROLE() : await governance.ISSUER_ROLE();
      const tx = await governance.proposeMember(onchain_address, name, role);
      const receipt = await tx.wait();
      txHash = receipt.hash;
    } catch (chainErr) {
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
    return serverError(res, "governance.proposeMember", err);
  }
}

// POST /governance/approve-member/:organizationId
async function approveMember(req, res) {
  try {
    const { organizationId } = req.params;
    const org = await Organization.findByPk(organizationId);
    if (!org) return res.status(404).json({ error: "Organisation not found." });

    let txHash = null;
    try {
      const admin = getSigner("ADMIN_PRIVATE_KEY");
      const governance = getContract("Governance", admin);
      const tx = await governance.approveMember(org.onchain_address);
      const receipt = await tx.wait();
      txHash = receipt.hash;
    } catch (chainErr) {
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
    return serverError(res, "governance.approveMember", err);
  }
}

// GET /governance/audit-log
async function getAuditLog(req, res) {
  try {
    const governanceEvents = await GovernanceEvent.findAll({ order: [["created_at", "DESC"]], limit: 100 });
    const statusEvents = await CredentialStatusEvent.findAll({ order: [["created_at", "DESC"]], limit: 100 });
    res.json({ governanceEvents, statusEvents });
  } catch (err) {
    return serverError(res, "governance.getAuditLog", err);
  }
}

// GET /governance/organizations
async function listOrganizations(req, res) {
  try {
    const organizations = await Organization.findAll({ order: [["created_at", "DESC"]] });
    res.json(organizations);
  } catch (err) {
    return serverError(res, "governance.listOrganizations", err);
  }
}

// GET /governance/pending-members
async function listPendingMembers(req, res) {
  try {
    const pending = await Organization.findAll({ where: { status: "PENDING" }, order: [["created_at", "DESC"]] });
    res.json(pending);
  } catch (err) {
    return serverError(res, "governance.listPendingMembers", err);
  }
}

// GET /governance/stats — aggregate counts for oversight dashboard
async function getGovernanceStats(req, res) {
  try {
    const [totalOrgs, activeOrgs, pendingOrgs, totalGovernanceEvents, totalStatusEvents] = await Promise.all([
      Organization.count(),
      Organization.count({ where: { status: "ACTIVE" } }),
      Organization.count({ where: { status: "PENDING" } }),
      GovernanceEvent.count(),
      CredentialStatusEvent.count()
    ]);
    res.json({ totalOrgs, activeOrgs, pendingOrgs, totalGovernanceEvents, totalStatusEvents });
  } catch (err) {
    return serverError(res, "governance.getGovernanceStats", err);
  }
}

module.exports = {
  proposeMember,
  approveMember,
  getAuditLog,
  listOrganizations,
  listPendingMembers,
  getGovernanceStats
};
