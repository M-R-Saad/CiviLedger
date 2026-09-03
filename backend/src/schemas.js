const { z } = require("zod");

const address = z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x Ethereum address");
const bytes32 = z.string().trim().regex(/^0x[a-fA-F0-9]{64}$/, "must be a 0x32-byte hex string");
const uuid = z.string().uuid();
const email = z.string().trim().email().max(254);

const schemas = {
  // ── auth ──────────────────────────────────────────────────────────────────
  register: z.object({
    full_name: z.string().trim().min(1).max(255),
    email,
    password: z.string().min(8).max(200),
    role: z.enum(["CITIZEN", "ISSUER_ADMIN", "VERIFIER_STAFF", "OVERSIGHT"]),
    organization_id: uuid.optional().nullable()
  }),
  login: z.object({
    email,
    password: z.string().min(1).max(200)
  }),
  walletNonce: z.object({ wallet_address: address }),
  walletLogin: z.object({
    wallet_address: address,
    signature: z.string().trim().regex(/^0x[a-fA-F0-9]{130}$/, "must be a 65-byte hex signature"),
    full_name: z.string().trim().min(1).max(255).optional()
  }),

  // ── issuer ────────────────────────────────────────────────────────────────
  issueCredential: z.object({
    credential_type_code: z.string().trim().min(1).max(50),
    citizen_wallet_address: address.optional(),
    citizen_user_id: uuid.optional(),
    payload: z.record(z.unknown()),
    expires_at: z.string().datetime().optional().nullable()
  }).refine((v) => v.citizen_wallet_address || v.citizen_user_id, {
    message: "citizen_wallet_address or citizen_user_id is required"
  }),
  changeStatus: z.object({
    action: z.enum(["SUSPEND", "REACTIVATE", "REVOKE"]),
    reason: z.string().trim().max(500).optional().default("")
  }),

  // ── citizen ───────────────────────────────────────────────────────────────
  createPresentation: z.object({
    credential_ids: z.array(uuid).min(1).max(20),
    consent_signature: z.string().max(400).optional(),
    consent_hash: bytes32.optional(),
    expiry_minutes: z.number().int().min(1).max(1440).optional()
  }),

  // ── governance ────────────────────────────────────────────────────────────
  proposeMember: z.object({
    name: z.string().trim().min(1).max(255),
    onchain_address: address,
    type: z.enum(["ISSUER", "VERIFIER", "BOTH"]),
    credential_types_authorized: z.array(z.string().trim().min(1).max(50)).max(20).optional().default([])
  }),

  // ── verifier ──────────────────────────────────────────────────────────────
  verify: z.object({ share_token: z.string().trim().min(10).max(64) })
};

module.exports = schemas;
