const blockchainService = require("./blockchain.service");
const hashingService = require("./hashing.service");

/**
 * Runs the full set of trust checks for a credential against the chain:
 *   1. content integrity  — recomputed payload hash matches the on-chain anchor
 *   2. issuer trust       — the anchoring address is a registered, active issuer
 *   3. on-chain status    — ACTIVE / SUSPENDED / REVOKED from CredentialStatus
 *   4. validity window    — not past the anchor's expiry
 *
 * Every chain read is guarded, so an unreachable node yields a CHAIN_UNREACHABLE
 * verdict rather than a 500. Each check returns a stable `code` the frontend
 * translates; no user-facing English is produced here.
 */

const STATUS = ["ACTIVE", "SUSPENDED", "REVOKED"];

// Worst-first. `overall` for a presentation is the worst verdict across its credentials.
const VERDICT_SEVERITY = [
  "HASH_MISMATCH",
  "ISSUER_NOT_TRUSTED",
  "ANCHOR_NOT_FOUND",
  "NOT_ANCHORED",
  "REVOKED",
  "EXPIRED",
  "SUSPENDED",
  "STATUS_UNKNOWN",
  "CHAIN_UNREACHABLE",
  "VALID"
];

function base(credential, extra) {
  return {
    credentialId: credential.id,
    credentialType:
      credential.CredentialType?.display_name ||
      credential.CredentialType?.code ||
      null,
    issuerName: credential.issuer?.name || null,
    checks: [],
    ...extra
  };
}

async function verifyCredential(credential) {
  const anchorId = credential.onchain_anchor_id;
  if (!anchorId) return base(credential, { verdict: "NOT_ANCHORED" });

  let anchor;
  try {
    anchor = await blockchainService.getAnchor(anchorId);
  } catch (err) {
    return base(credential, { verdict: "CHAIN_UNREACHABLE", error: err.message });
  }
  if (!anchor || !anchor.exists) {
    return base(credential, { verdict: "ANCHOR_NOT_FOUND" });
  }

  const checks = [];

  // 1. Content integrity
  const recomputed = hashingService.hashPayload(credential.payload);
  const onChainHash = String(anchor.payloadHash || "").toLowerCase();
  const hashPass = recomputed.toLowerCase() === onChainHash;
  checks.push({
    key: "hash",
    pass: hashPass,
    code: hashPass ? "hash.match" : "hash.mismatch",
    evidence: [
      { labelKey: "verify.evidence.expectedHash", value: recomputed, kind: "hash" },
      { labelKey: "verify.evidence.onChainHash", value: onChainHash, kind: "hash" }
    ]
  });

  // 2. Issuer trust
  let issuer = { active: false, name: credential.issuer?.name || null };
  try {
    issuer = await blockchainService.getIssuerInfo(anchor.issuer);
  } catch {
    /* treat as inactive */
  }
  checks.push({
    key: "issuer",
    pass: issuer.active,
    code: issuer.active ? "issuer.active" : "issuer.inactive",
    vars: { issuer: issuer.name || anchor.issuer },
    evidence: [
      { labelKey: "verify.evidence.issuerAddress", value: anchor.issuer, kind: "address" }
    ]
  });

  // 3. On-chain status
  let statusValue = "UNKNOWN";
  try {
    statusValue = await blockchainService.getStatus(anchorId);
  } catch {
    statusValue = "UNKNOWN";
  }
  if (!STATUS.includes(statusValue)) statusValue = "UNKNOWN";
  checks.push({
    key: "status",
    pass: statusValue === "ACTIVE",
    code: `status.${statusValue.toLowerCase()}`
  });

  // 4. Validity window
  const expiresAtSec = Number(anchor.expiresAt || 0);
  const nowSec = Math.floor(Date.now() / 1000);
  const expired = expiresAtSec !== 0 && nowSec > expiresAtSec;
  const dateStr = expiresAtSec
    ? new Date(expiresAtSec * 1000).toISOString().slice(0, 10)
    : null;
  checks.push({
    key: "expiry",
    pass: !expired,
    code: expiresAtSec === 0 ? "expiry.none" : expired ? "expiry.expired" : "expiry.ok",
    vars: dateStr ? { date: dateStr } : {}
  });

  let verdict = "VALID";
  if (!hashPass) verdict = "HASH_MISMATCH";
  else if (!issuer.active) verdict = "ISSUER_NOT_TRUSTED";
  else if (statusValue === "REVOKED") verdict = "REVOKED";
  else if (statusValue === "SUSPENDED") verdict = "SUSPENDED";
  else if (expired) verdict = "EXPIRED";
  else if (statusValue === "UNKNOWN") verdict = "STATUS_UNKNOWN";

  return base(credential, {
    verdict,
    checks,
    anchor: {
      anchorId,
      issuer: anchor.issuer,
      issuedAt: new Date(Number(anchor.issuedAt) * 1000).toISOString()
    }
  });
}

async function verifyPresentationCredentials(credentials) {
  const results = [];
  for (const credential of credentials) {
    results.push(await verifyCredential(credential));
  }
  if (!results.length) return { overall: "NOT_ANCHORED", results };

  let overall = "VALID";
  for (const r of results) {
    if (VERDICT_SEVERITY.indexOf(r.verdict) < VERDICT_SEVERITY.indexOf(overall)) {
      overall = r.verdict;
    }
  }
  return { overall, results };
}

// Collapse a verdict onto the existing VerificationEvent.result ENUM.
// Indeterminate verdicts return null: we do not record an official verification
// we could not actually complete.
function toEventResult(verdict) {
  switch (verdict) {
    case "VALID":
      return "VALID";
    case "HASH_MISMATCH":
      return "INVALID_SIGNATURE";
    case "REVOKED":
    case "SUSPENDED":
      return "REVOKED";
    case "EXPIRED":
      return "EXPIRED";
    case "ISSUER_NOT_TRUSTED":
    case "ANCHOR_NOT_FOUND":
    case "NOT_ANCHORED":
      return "ISSUER_NOT_TRUSTED";
    default:
      return null;
  }
}

module.exports = {
  verifyCredential,
  verifyPresentationCredentials,
  toEventResult
};
