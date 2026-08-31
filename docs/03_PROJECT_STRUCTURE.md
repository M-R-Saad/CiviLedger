# CiviLedger — Project Structure

This is a **monorepo** layout: one Git repo with three top-level workspaces (`contracts`, `backend`, `frontend`). This is easier to manage solo/small-team than three separate repos, and matches most Hardhat + React tutorials you'll find.

```
civiledger/
├── README.md
├── .gitignore
├── .env.example
│
├── contracts/                          # Blockchain layer (Solidity + Hardhat)
│   ├── contracts/
│   │   ├── Governance.sol              # ADMIN/ISSUER/VERIFIER/OVERSIGHT roles (OpenZeppelin AccessControl)
│   │   ├── IssuerRegistry.sol          # registerIssuer, updateIssuerStatus, rotateIssuerKey, getIssuer
│   │   ├── CredentialRegistry.sol      # issueAnchor, getAnchor, verifyAnchor, supersedeCredential
│   │   ├── CredentialStatus.sol        # suspend, reactivate, revoke, getStatus
│   │   └── ConsentAudit.sol            # recordConsentHash, recordPresentationReceipt, queryCitizenAudit
│   ├── test/
│   │   ├── Governance.test.js
│   │   ├── IssuerRegistry.test.js
│   │   ├── CredentialRegistry.test.js
│   │   ├── CredentialStatus.test.js
│   │   └── ConsentAudit.test.js
│   ├── scripts/
│   │   ├── deploy.js                   # deploys all 5 contracts in the right order, wires addresses together
│   │   ├── seed-demo-data.js           # registers the 3 demo issuer orgs on-chain for local testing
│   │   └── verify-on-explorer.js       # (later) verifies deployed contracts on Polygonscan
│   ├── hardhat.config.js
│   ├── package.json
│   └── deployments/
│       ├── localhost.json              # contract addresses after local deploy (auto-generated, git-ignored)
│       └── amoy.json                   # contract addresses after testnet deploy (auto-generated, git-ignored)
│
├── backend/                            # Application layer (Node.js/Express + ethers.js + Postgres)
│   ├── src/
│   │   ├── index.js                    # Express app entrypoint
│   │   ├── config/
│   │   │   ├── db.js                   # Postgres connection (pg / Prisma / Sequelize — pick one)
│   │   │   └── blockchain.js           # ethers.js provider + contract instances, reads deployments/*.json
│   │   ├── contracts-abi/              # copied automatically from contracts/artifacts after each build
│   │   │   ├── Governance.json
│   │   │   ├── IssuerRegistry.json
│   │   │   ├── CredentialRegistry.json
│   │   │   ├── CredentialStatus.json
│   │   │   └── ConsentAudit.json
│   │   ├── models/                     # one file per DB table in 02_database_schema.json
│   │   │   ├── User.js
│   │   │   ├── Organization.js
│   │   │   ├── CredentialType.js
│   │   │   ├── Credential.js
│   │   │   ├── PurposeSpecificCredential.js
│   │   │   ├── Presentation.js
│   │   │   ├── VerificationEvent.js
│   │   │   ├── GovernanceEvent.js
│   │   │   ├── CredentialStatusEvent.js
│   │   │   └── Document.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js          # login/register, JWT issuance
│   │   │   ├── issuer.routes.js        # issue credential, revoke/suspend, list issued
│   │   │   ├── citizen.routes.js       # list my credentials, create presentation/share link
│   │   │   ├── verifier.routes.js      # fetch presentation by token, verify, log result
│   │   │   ├── governance.routes.js    # propose/approve member, view audit log (OVERSIGHT)
│   │   │   └── credential-types.routes.js
│   │   ├── controllers/
│   │   │   ├── issuer.controller.js
│   │   │   ├── citizen.controller.js
│   │   │   ├── verifier.controller.js
│   │   │   └── governance.controller.js
│   │   ├── services/
│   │   │   ├── hashing.service.js      # canonicalize JSON + keccak256, MUST match on-chain hash logic
│   │   │   ├── blockchain.service.js   # wraps all ethers.js contract calls (issueAnchor, getStatus, etc.)
│   │   │   ├── reconciliation.service.js # re-checks on-chain truth before trusting cached status
│   │   │   └── qrcode.service.js       # generates QR for presentation share links
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js      # JWT verification
│   │   │   └── role.middleware.js      # role-gate routes (ISSUER_ADMIN, VERIFIER_STAFF, OVERSIGHT)
│   │   └── utils/
│   │       └── logger.js
│   ├── migrations/                     # SQL migration files generated from 02_database_schema.json
│   ├── package.json
│   └── .env.example
│
├── frontend/                           # Client layer (React + TypeScript + Vite)
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                     # role-based routing (Citizen / Issuer / Verifier / Oversight views)
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── Login.tsx
│   │   │   │   └── ConnectWallet.tsx   # MetaMask connect flow for citizens
│   │   │   ├── citizen/
│   │   │   │   ├── WalletHome.tsx      # list held credentials
│   │   │   │   ├── ShareCredential.tsx # pick credentials → sign consent → generate QR/link
│   │   │   │   └── AuditHistory.tsx    # citizen's own consent/share history
│   │   │   ├── issuer/
│   │   │   │   ├── IssueDashboard.tsx  # list of citizens, issue new credential form
│   │   │   │   ├── IssueCredentialForm.tsx
│   │   │   │   └── ManageCredential.tsx # suspend/revoke/supersede
│   │   │   ├── verifier/
│   │   │   │   ├── ScanPresentation.tsx # QR scanner or token paste
│   │   │   │   └── VerificationResult.tsx
│   │   │   └── oversight/
│   │   │       ├── GovernanceDashboard.tsx # approve new issuer orgs
│   │   │       └── AuditLog.tsx
│   │   ├── components/
│   │   │   ├── layout/ (Navbar, Sidebar, RoleGuard)
│   │   │   ├── credentials/ (CredentialCard, CredentialBadge, StatusPill)
│   │   │   └── common/ (Button, Modal, QRCodeDisplay, LoadingSpinner)
│   │   ├── hooks/
│   │   │   ├── useWallet.ts            # MetaMask connect/sign hook
│   │   │   ├── useAuth.ts
│   │   │   └── useApi.ts               # wraps fetch calls to backend
│   │   ├── services/
│   │   │   └── api.ts                  # base axios/fetch client, typed endpoints matching backend routes
│   │   ├── types/
│   │   │   └── index.ts                # shared TS types mirroring DB schema
│   │   └── styles/
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                                # for the competition submission
│   ├── 01_PROJECT_OVERVIEW.md
│   ├── 02_database_schema.json
│   ├── 03_PROJECT_STRUCTURE.md
│   ├── 04_WORKFLOW.md
│   └── architecture-diagrams/           # exported PNGs of Figure 1 / Figure 2 from the whitepaper
│
└── docker-compose.yml                   # optional: spins up Postgres + backend + frontend together for the demo
```

## Notes on This Structure
- **`contracts/artifacts` → `backend/src/contracts-abi`**: after every `npx hardhat compile`, copy the generated ABI JSON files into the backend so it knows how to call your contracts. A small npm script (`sync-abi`) can automate this copy step.
- **One frontend app, not three**: the whitepaper's Figure 1 shows 3 separate React apps (Citizen Wallet, Issuer Dashboard, Verifier Portal). For the prototype, build **one app with role-based routing** instead — same user experience for judges, a fraction of the setup/deployment work. You can mention in your report that production would split these into separate deployable apps.
- **`deployments/*.json`**: Hardhat can auto-write contract addresses here after each deploy; both backend and any deploy scripts read from it, so you never hardcode an address.
- You don't need Docker for local development — plain `npm run dev` in each workspace is fine. `docker-compose.yml` is only useful right before the demo if you want one-command startup.
