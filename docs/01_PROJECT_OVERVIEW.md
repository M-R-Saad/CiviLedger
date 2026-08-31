# CiviLedger — Project Overview

## 1. What We're Building
CiviLedger is a **consortium blockchain credential verification system**. Three simulated authorities (Identity, Education, Transport) issue digital credentials to citizens. Citizens hold these credentials in a wallet app and selectively share them with verifiers (employers, banks, etc.), who check authenticity and status instantly, without calling the issuing office.

**Core idea in one sentence:** issuers sign credentials → a hash/status gets written on-chain → citizens hold the full credential off-chain in a wallet → verifiers check the on-chain proof + off-chain payload the citizen shares with them.

## 2. Why This Is Simpler Than It Sounds
You don't need to build a "real" multi-organization blockchain network with physically separate servers for an Olympiad prototype. That's the single biggest time-sink in the original whitepaper plan. Here's the simplification:

| Whitepaper Plan | Recommended Simplification | Why |
|---|---|---|
| 3 separate Hyperledger Besu validator nodes, IBFT 2.0 consensus | **Single local Hardhat blockchain network** (or one testnet deployment) | Running/syncing 3 real nodes is a devops project on its own. A single chain with 3 different *wallet addresses/roles* (Identity, Education, Transport) simulates the 3-organization model perfectly for a demo — the smart contract logic and role separation are identical either way. |
| Deploy to production-like permissioned network | **Deploy once to a public testnet** (e.g. Polygon Amoy or Ethereum Sepolia) for the live demo, keep Hardhat local network for dev | Free, no server maintenance, judges can verify transactions on a public block explorer (Etherscan/Polygonscan) — this is actually *more* impressive for a demo than a private node they can't inspect. |
| Custom-built consensus/network setup | Skip entirely | You still say "designed for permissioned consortium deployment (Besu/IBFT) in production" in your report — the prototype just runs on Hardhat/testnet, which is standard practice for hackathons. |
| BBS+ zero-knowledge selective disclosure | Purpose-specific minimal credentials (e.g., issue a separate "is-above-18" credential alongside the full one) | This was already the whitepaper's own fallback (Section 4.6) — keep it, it's the right call. |

Everything else in the whitepaper (contracts, roles, credential lifecycle, on-chain/off-chain split) stays conceptually the same — we're only changing *how many machines* the chain runs on, not the architecture.

## 3. Recommended Tech Stack (Final)

| Layer | Technology | Notes |
|---|---|---|
| Smart contracts | **Solidity** + OpenZeppelin AccessControl | Same as whitepaper |
| Contract dev/test | **Hardhat** | Same as whitepaper |
| Blockchain network | **Hardhat local network** for dev → **Polygon Amoy testnet** for demo | Simplification — see above |
| Blockchain connectivity | **ethers.js v6** | Same as whitepaper |
| Backend | **Node.js + Express** | Same as whitepaper |
| Frontend | **React + TypeScript + Vite** (one app with 3 role-based views, not 3 separate apps) | Simplification — one app is much faster to build/deploy than three; you switch "role" via login |
| Off-chain DB | **PostgreSQL** (or **SQLite** if you want zero setup during dev) | SQLite is a drop-in swap, same SQL, no server to run locally |
| File/document storage (scans, etc.) | Local disk / mocked file upload for prototype (skip real encryption-at-rest complexity for MVP, mention it as planned) | Keep prototype scope realistic |
| Wallet for citizens | **MetaMask** (browser extension) — citizen "signs" consent transactions with it | Standard, well-documented, huge amount of tutorials |
| Auth (off-chain app login) | Simple JWT-based auth for issuer/verifier dashboards; citizen uses wallet address as identity | Keeps it web-dev-familiar |

## 4. Actors / Roles
1. **Identity Authority (Issuer)** — issues NID-based identity credentials
2. **Education Authority (Issuer)** — issues academic/degree credentials
3. **Transport Authority (Issuer)** — issues driving license credentials
4. **Citizen** — holds credentials in wallet, decides what to share
5. **Verifier** — employer/bank/etc., scans/requests a presentation, checks validity
6. **Oversight/Admin** — governance role, can view audit logs, approve new issuer members

For the prototype, all 3 issuer roles + oversight can be simulated by an admin panel that lets you switch "logged in as" — you don't need 3 real institutions, 3 real logins with real data are enough.

## 5. On-chain vs Off-chain (unchanged from whitepaper, this split is correct and standard practice)

**On-chain (blockchain):**
- Credential hash (proof of what was issued, not the content)
- Issuer address / organization ID
- Credential type + schema version
- Issue timestamp / expiry
- Status: active / suspended / revoked
- Consent event hashes (audit trail)
- Governance/membership events (who is a valid issuer)

**Off-chain (Postgres + file storage):**
- Full credential payload (JSON) — degree name, license class, etc.
- Personal data (name, address, phone, DOB, etc.)
- Document scans / attachments
- Encryption keys
- Anything requiring deletion/correction rights (GDPR-style, can't live on an immutable ledger)

## 6. Core Smart Contracts (unchanged logic from whitepaper)
1. **IssuerRegistry.sol** — register issuer, update status, rotate key, get issuer
2. **CredentialRegistry.sol** — issue anchor (hash), get anchor, verify anchor, supersede
3. **CredentialStatus.sol** — suspend / reactivate / revoke, emits events
4. **ConsentAudit.sol** — record consent hash, record presentation receipt, query citizen audit trail
5. **Governance.sol** — propose/approve/suspend member, role management (ADMIN, ISSUER, VERIFIER, OVERSIGHT) via OpenZeppelin AccessControl

## 7. Credential Lifecycle (unchanged)
Issue → Anchor (hash written on-chain) → Hold (citizen wallet) → Share (citizen consents, sends presentation to verifier) → Verify (verifier checks signature/issuer/status) → (optional) Revoke/Supersede at any point after anchoring.

## 8. MVP Scope for the Olympiad Demo
To keep this achievable, the prototype should demonstrate **one complete credential type end-to-end** first (recommend: **academic/education credential**, it's the easiest to make a convincing demo out of — "verify a graduate's degree"), then replicate the pattern for identity and driving license once the pipeline works.

**Must-have for demo day:**
- Issuer dashboard: issue a credential to a citizen's wallet address
- Citizen wallet: view held credentials, generate a shareable presentation (QR code or link) with MetaMask signature as consent
- Verifier portal: scan/paste the presentation, see "✅ Valid — Issued by X, Active" or "❌ Revoked/Invalid"
- Admin/oversight: view an audit log of issuance/verification/revocation events
- At least one revoke → verify-fails demo flow (this is the "wow" moment for judges)

**Nice-to-have (only if time remains):**
- Age-over-18 purpose-specific minimal credential demo
- Multiple credential types (identity + academic + driving)
- QR-code based sharing instead of just copy-paste links
- Deployed testnet version with a public explorer link

## 9. What You'll Need to Set Up (accounts/tools)
- Node.js (v18+) installed locally
- MetaMask browser extension
- A code editor (VS Code)
- Free Alchemy or Infura account (RPC endpoint for testnet deployment) — only needed at the very end when deploying to Polygon Amoy
- Free testnet MATIC from a faucet (for gas on Polygon Amoy) — only needed for the final testnet deployment step
- GitHub repo (required by competition rules anyway)

## 10. Learning Curve Note
You have web dev experience, so the parts that will feel *completely normal* to you: React frontend, Express backend, Postgres schema, REST APIs, JWT auth. The genuinely new parts are:
- Writing Solidity contracts (syntax is C-like/JS-like, OpenZeppelin templates do most of the heavy lifting)
- Using Hardhat to compile/test/deploy contracts
- Using ethers.js to call contract functions from your Express/React code (this is really just "calling an API," conceptually)
- MetaMask connect + signing flow (a few well-documented hooks/functions)

The workflow file (04_WORKFLOW.md) sequences things so you learn the blockchain-specific pieces in small, testable steps rather than all at once.
