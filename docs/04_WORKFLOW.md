# CiviLedger — Build Workflow (What To Do, In Order)

This sequence is designed so you build and test one small, working piece at a time. Each phase ends with something you can actually run and see work, before moving to the next. Do not skip ahead to frontend before Phase 2 is solid — debugging contracts through a UI is much harder than debugging them in Hardhat's test console.

---

## Phase 0 — Setup (½ day)
1. Install Node.js (v18+), VS Code, MetaMask browser extension.
2. Create the GitHub repo (required by the competition) with the folder structure from `03_PROJECT_STRUCTURE.md`.
3. `npx hardhat init` inside `contracts/` to scaffold the Hardhat project.
4. Confirm you can run `npx hardhat test` with the default sample contract — this validates your toolchain works before you write any real code.

---

## Phase 1 — Smart Contracts, One at a Time (3–5 days)
Build and test contracts in this order — each one is simpler than the next and later ones depend on earlier ones existing:

1. **Governance.sol** first. This defines your roles (ADMIN, ISSUER, VERIFIER, OVERSIGHT) using OpenZeppelin's `AccessControl`. Everything else checks against this.
   - Write `proposeMember()`, `approveMember()`, `suspendMember()`.
   - Write a Hardhat test that deploys it, proposes a member, approves it, and asserts the role was granted.
2. **IssuerRegistry.sol** next — depends on Governance for role checks.
   - `registerIssuer()`, `updateIssuerStatus()`, `rotateIssuerKey()`, `getIssuer()`.
   - Test: register an issuer, confirm `getIssuer()` returns correct data, confirm a non-ADMIN account cannot register one (this negative test matters — it's your access-control proof).
3. **CredentialRegistry.sol** — depends on IssuerRegistry (only a registered issuer can anchor a credential).
   - `issueAnchor(hash, citizenAddress, credentialType)`, `getAnchor()`, `verifyAnchor()`, `supersedeCredential()`.
   - Test: issue an anchor as a registered issuer, confirm it fails from a non-issuer address.
4. **CredentialStatus.sol** — depends on CredentialRegistry (status is tied to an anchor).
   - `suspend()`, `reactivate()`, `revoke()`, `getStatus()`, with events emitted on every change.
   - Test: issue → revoke → confirm `getStatus()` returns REVOKED and that a suspended/revoked credential cannot be "verified" as active.
5. **ConsentAudit.sol** last — the simplest, mostly an append-only log.
   - `recordConsentHash()`, `recordPresentationReceipt()`, `queryCitizenAudit()`.
   - Test: record a consent hash, query it back.

**Checkpoint:** by the end of Phase 1 you should have 5 contracts, each with passing tests, deployable together via one `deploy.js` script that wires their addresses together (e.g., CredentialRegistry needs to know IssuerRegistry's address in its constructor). Run `deploy.js` against Hardhat's local network and confirm it prints 5 contract addresses with no errors.

---

## Phase 2 — Backend Wiring (3–4 days)
Do this **before** touching the frontend. If your backend can issue/verify credentials correctly via a script or Postman/curl, the frontend becomes "just" a UI on top of working logic.

1. Set up Postgres (or SQLite for zero-friction local dev) using the schema in `02_database_schema.json`. Write migrations for each table.
2. Set up `backend/src/config/blockchain.js`: connect ethers.js to your local Hardhat network, load the 5 deployed contract addresses + ABIs.
3. Build `hashing.service.js` first and test it in isolation — canonicalize a sample JSON payload and hash it with keccak256. This hash logic must be **identical** on backend and (implicitly) what you compare against on-chain, so get this right early with a unit test.
4. Build the **issuer flow** end-to-end:
   - `POST /issuer/credentials` → saves full payload to `credentials` table off-chain, computes hash, calls `CredentialRegistry.issueAnchor()` on-chain, stores the returned tx hash back on the row.
   - Test with curl/Postman before any UI exists.
5. Build the **citizen flow**:
   - `GET /citizen/credentials` → list credentials where `citizen_user_id` matches.
   - `POST /citizen/presentations` → picks credential IDs, records a `presentations` row, calls `ConsentAudit.recordConsentHash()`, returns a share token/link.
6. Build the **verifier flow**:
   - `GET /verifier/presentations/:token` → looks up the presentation, fetches associated credentials.
   - `POST /verifier/verify` → re-checks live on-chain status via `CredentialStatus.getStatus()` (never trust only the DB cache), logs a `verification_events` row, calls `ConsentAudit.recordPresentationReceipt()`.
7. Build the **oversight/governance flow**:
   - `POST /governance/propose-member`, `POST /governance/approve-member` → call Governance.sol, mirror events into `governance_events` table.
   - `GET /governance/audit-log` → reads `governance_events` + `credential_status_events`.

**Checkpoint:** you can, purely through curl/Postman calls, issue a credential, generate a presentation, "verify" it successfully, then revoke it and watch the same verification now fail. This is your entire demo's core logic proven before any UI exists.

---

## Phase 3 — Frontend (4–6 days)
Now build the UI on top of the already-working backend. Build in this order so you always have something demoable:

1. Auth: Login page + JWT storage + MetaMask "Connect Wallet" hook for citizens.
2. Issuer Dashboard: form to issue a credential → calls your already-tested `POST /issuer/credentials`.
3. Citizen Wallet: list credentials, "Share" button → generates presentation → shows QR code + link.
4. Verifier Portal: paste/scan a presentation token → shows verification result (✅/❌ with reason).
5. Oversight Dashboard: governance approvals + audit log table.
6. Polish: role-based routing/guards, loading states, status badges (Active/Suspended/Revoked color coding).

**Checkpoint:** full demo flow works clicking through the actual UI: issue → share → verify → revoke → re-verify (fails).

---

## Phase 4 — Demo Hardening (1–2 days)
1. Seed realistic demo data: 3 issuer orgs, a handful of citizens, a couple of verifiers, using `seed-demo-data.js`.
2. Write a fixed demo script (which exact accounts/credentials you'll click through) so nothing is improvised live.
3. (Optional, do only if time allows) Deploy contracts to **Polygon Amoy testnet** instead of local Hardhat network, so judges can see real transactions on a public block explorer. Swap the backend's RPC URL/contract addresses to the testnet deployment — same code, different network.
4. Record a backup demo video in case live wallet/network issues happen during judging.

---

## Phase 5 — Documentation for Submission (parallel, ongoing)
- Keep `docs/01_PROJECT_OVERVIEW.md` updated with anything you changed from the plan.
- Export the architecture diagrams (Figure 1/2 style) reflecting the actual simplified network (mention the Hardhat/testnet simplification honestly — judges respect a clearly justified scope decision more than an unfinished attempt at the original plan).
- Fill in the governance checklist (whitepaper Section 4.8) with what you actually implemented vs. what's marked as future work.

---

## Suggested Time Allocation (assuming ~3 weeks)
| Phase | Time | Cumulative |
|---|---|---|
| 0 — Setup | 0.5 day | 0.5 day |
| 1 — Contracts | 3–5 days | ~5.5 days |
| 2 — Backend | 3–4 days | ~9.5 days |
| 3 — Frontend | 4–6 days | ~15.5 days |
| 4 — Demo hardening | 1–2 days | ~17.5 days |
| 5 — Docs | ongoing | — |

This leaves a few days of buffer in a 3-week window. If you're tighter on time, the safest thing to cut is **multiple credential types** — get identity OR academic working perfectly end-to-end before replicating the pattern for the other two.
