const blockchainService = require("./blockchain.service");

/**
 * Re-checks the live on-chain status for a credential before trusting the cached
 * status_cache column. Use this in the verifier flow — never make a final trust
 * decision from the DB cache alone. See docs/02_database_schema.json ->
 * on_chain_offchain_reconciliation for the rationale.
 */
async function reconcileCredentialStatus(credential) {
  if (!credential.onchain_anchor_id) {
    return { status: credential.status_cache, source: "DB_ONLY_NOT_YET_ANCHORED" };
  }
  const liveStatus = await blockchainService.getStatus(credential.onchain_anchor_id);
  return { status: liveStatus, source: "ONCHAIN", matchesCache: liveStatus === credential.status_cache };
}

module.exports = { reconcileCredentialStatus };
