const { ethers } = require("ethers");

/**
 * Canonicalize a JS object into a deterministic JSON string (sorted keys, recursively)
 * so the same payload always produces the same hash, regardless of key insertion order.
 */
function canonicalize(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(canonicalize).join(",")}]`;

  const keys = Object.keys(obj).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${canonicalize(obj[key])}`);
  return `{${entries.join(",")}}`;
}

/**
 * Produces the same style of hash used by CredentialRegistry.sol's payloadHash parameter.
 * IMPORTANT: keep this in sync with any hashing logic used on-chain — the whole trust
 * model depends on backend-computed hashes matching what verifiers can independently recompute.
 */
function hashPayload(payload) {
  const canonical = canonicalize(payload);
  return ethers.keccak256(ethers.toUtf8Bytes(canonical));
}

module.exports = { canonicalize, hashPayload };
