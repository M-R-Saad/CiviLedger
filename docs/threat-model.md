# Threat model

Derived from PLAN.html §17, with the control for each threat traced to the code
that implements it. A control with no line of code behind it is written here as
unmitigated, because a threat model that flatters the system is worse than none.

---

## 1. CiviLedger insider forges a credential

**Impact:** total loss of trust. This is the existential one, and the reason
the ledger exists at all.

**Controls**

- Issuer signing keys are reached only through a `SignerProvider`
  ([`signer-provider.ts`](../services/api/src/services/signer-provider.ts)).
  The production implementation calls a KMS in the *institution's own* tenant
  against a non-exportable key.
- `LocalDevSignerProvider` refuses to construct when `NODE_ENV=production` or
  `ALLOW_REAL_PERSONAL_DATA=true`, so the development path cannot be used where
  it would break the invariant.
- Registry writes require M-of-N approval across **distinct organisations**
  ([`Governance.sol`](../contracts/src/Governance.sol)). Approvals are counted
  per organisation, so three admin keys held by one institution count once.
- `Governance` holds `DEFAULT_ADMIN_ROLE` over itself, so no human can bypass
  the proposal flow through OpenZeppelin's own API.
- Anchors are checkpointed to a public network weekly, making a rewrite
  externally provable.

**Residual risk.** Until a second organisation runs a node, the threshold is 1
and this control is procedural rather than cryptographic. PLAN §3 is explicit
that we do not claim otherwise. `organisationCount` and `threshold` are public
on chain; anyone can check what they actually are.

---

## 2. Issuer insider signs a fake degree

**Impact:** a real forgery carrying a valid signature.

This cannot be prevented cryptographically. Only detected.

**Controls**

- Four-eyes approval: whoever uploaded a batch may not approve it
  ([`issuance.service.ts`](../services/api/src/services/issuance.service.ts),
  `FOUR_EYES_REQUIRED`). Enforced in the service, not the route, so it holds
  however a batch is approved.
- Capability separation: `REGISTRAR` can import but not approve.
- Immutable batch history: every batch records who prepared and who approved
  it, and its Merkle root is anchored.
- `AuditEvent` rows for every approval and revocation.

**Not implemented.** Anomaly detection on out-of-cohort or off-hours issuance
is not built. The data to run it exists (`batches`, `credentials.issuedAt`), so
this is a gap in analysis, not in instrumentation.

---

## 3. Issuer signing key stolen

**Impact:** mass forgery within a time window.

**Controls**

- `IssuerRegistry.revokeKey(orgId, epoch, reason, effectiveFrom)` cuts an epoch
  short at a chosen instant. Credentials signed before that instant stay valid,
  which is precisely why `keyAt` takes a timestamp.
- A revocation may bring a window forward but never extend it, so it cannot
  retroactively re-validate a superseded key
  ([`IssuerRegistry.sol`](../contracts/src/IssuerRegistry.sol);
  `test_revokeKey_cannotExtendAnAlreadyClosedEpoch`).
- Key history is append-only; a rotation never destroys the record of what the
  old key signed.

**Not implemented.** Alerting on issuance volume and off-hours signing.

---

## 4. Share link replayed by a third party

**Impact:** a genuine credential presented by the wrong person.

**Controls**

- Tokens are 256 bits of CSPRNG output, stored only as a SHA-256 digest, so a
  database read cannot mint a presentation.
- Short TTL, capped server-side, and a use count enforced on redemption.
- Purpose binding, recorded in the consent receipt.
- Holder binding: a key-binding JWT covers `sd_hash`, so a captured KB-JWT
  cannot be replayed against a wider claim scope
  (`rejects a key-binding JWT replayed against a different claim scope`).
- The verifier's identity is recorded in a receipt the graduate can read.

---

## 5. Status list suppressed or rolled back

**Impact:** a revoked credential verifies as valid. The highest-value attack
against the product.

**Controls**

- Monotonic on-chain version; `StatusRegistry` reverts on any version that does
  not strictly increase.
- Hash comparison on every fetch, over the served bytes.
- Client-side rollback floor, persisted, rejecting any regression
  ([`published.ts`](../packages/status-list/src/published.ts), `VERSION_ROLLBACK`).
- A list newer than its anchor is honoured but reported as pending rather than
  matched, so a revocation is never suppressed by a slow transaction.
- Freshness window on every result.

Tested end to end as an attack in
`rejects a rolled-back status list that would suppress a revocation`.

---

## 6. Correlation of a person across verifiers

**Impact:** surveillance by inference.

**Controls**

- No stable per-citizen on-chain identifier. Nothing on chain identifies a
  person; the previous system put citizen wallet addresses in indexed event
  topics, making every credential a person held enumerable with one log query.
- Random status-list index allocation
  ([`bitstring.ts`](../packages/status-list/src/bitstring.ts)). Sequential
  indices would leak cohort and issuance order to anyone holding the list, and
  the list is public.
- Decoy digests in `_sd`, so the number of withheld claims cannot be counted.
- No per-presentation on-chain writes, ever.
- Salted anchor leaves; the salt never leaves the database.

**Residual risk.** A verifier that sees the same anchor leaf twice can tell it
is the same credential. Anchor proofs are therefore optional in a presentation
and are attached at the verifier's request, not by default.

---

## 7. Node collusion or history rewrite

**Impact:** ledger claims become worthless.

**Controls**

- Weekly public checkpoint of the state root
  ([`AuditAnchor.checkpoint`](../contracts/src/AuditAnchor.sol)), so any
  rewrite is externally provable.
- Checkpoints must strictly advance.
- Node operator identities are published.

**Residual risk.** On the devnet all four validators are ours. That is not a
consortium and is documented as such in [infra/README.md](../infra/README.md).

---

## 8. Phishing verifier harvesting credentials

**Impact:** claim data collected under false pretence.

**Controls**

- KYB before API access: `resolveApiKey` rejects any verifier whose
  `kybStatus` is not `VERIFIED`.
- Claim scope is fixed when the holder creates the link and enforced
  server-side on redemption. A verifier cannot receive a claim the holder did
  not agree to disclose, whatever it asks for.
- Every verification writes a consent receipt the graduate can read, naming the
  verifier, the purpose and the exact claims disclosed. This is the control
  that makes a phishing verifier *discoverable*.
- Quotas per verifier, enforced before the work is done.

---

## 9. PII in logs or error traces

**Impact:** regulatory breach under the PDPA.

**Controls**

- Structured logging with a field deny-list
  ([`app.ts`](../services/api/src/app.ts) `redact.paths`), covering
  authorization headers, API keys, passwords, CSV bodies and presentations.
- Request URLs are logged without their query string, which can carry a share
  token.
- Unrecognised errors are logged in full but returned as an opaque 500: an
  internal message can carry a claim value or a query fragment.
- `redact()` in [`errors.ts`](../services/api/src/lib/errors.ts) strips known
  personal field names from any error detail that does reach a response.
- Asserted in test: `never leaks a claim value into the evidence of a failed
  check`.

**Not implemented.** A CI check that fails on known PII field names appearing
in log call sites. PLAN §17 asks for one.

---

## 10. Database compromise

Not in PLAN §17, added because it is the most likely breach in practice.

**Impact:** disclosure of every graduate's records.

**Controls**

- Envelope encryption on every column holding personal data, with a per-row
  data key wrapped by a KEK held outside the database
  ([`crypto.ts`](../services/api/src/lib/crypto.ts)).
- Email is searchable only through an HMAC blind index, so a dump is not a
  mailing list and a bare hash is not a lookup-table away from the address.
- Passwords are Argon2id.
- Session and share tokens are stored hashed; reading the table grants nothing.
- Asserted in test: `stores no plaintext personal data` reads the raw bytes
  back out of Postgres and greps them.

**Residual risk.** An attacker with both the database and the KEK reads
everything. That is what the KEK living in a KMS, with its own access log, is
for.

---

## 11. Stale or partial deployment

Not in PLAN §17, added after it actually happened during development.

**Impact:** the database and the chain disagree, and every verification fails
or, worse, silently passes against the wrong key.

**Controls**

- `chainIssuerDirectory` resolves the key from the chain and matches it against
  the stored public JWK. A mismatch resolves to "not in registry" rather than
  falling back to whatever the database holds.
- Status list versions take their floor from the chain, so a database restored
  from backup republishes forward instead of deadlocking behind a counter the
  chain has already passed.
- `LocalDevSignerProvider` refuses to load a key whose thumbprint does not
  match the one the chain vouches for.
- `/health/ready` reports database and ledger independently.

---

## Summary of unmitigated items

| Gap | Where it belongs |
|---|---|
| Anomaly detection on issuance patterns | Analysis over existing data |
| Alerting on issuance volume and off-hours signing | Operations |
| CI check for PII field names in log calls | CI |
| Independent security review of contracts | PLAN §23, phase 3 |
| Real M-of-N across distinct organisations | Blocked on nodes two and three |
