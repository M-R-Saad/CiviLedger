# BCOLBD 2026 – Blockchain Category Whitepaper

# CiviLedger
### A Consortium Blockchain for Decentralized Information Verification System of Citizens and Residents of a Country

**Team:** HexaMind | United International University
**Members:** Muhaiminul Rashid Shad (Team Lead), Abrar Jahin, Sumaya Zaman, Md. Shahriar Morshed, Md Ahnaf Tahmid, Nusrat Jahan Moon

---

## 1. Problem and Solution

### 1.1 Problem Context

A citizen interacts with dozens of institutions over a lifetime – identity, birth, education, driving, taxation, employment, professional licensing, and social-benefit authorities each issue and maintain their own records. That separation exists for good reason: no single agency should hold everything. The problem starts when one institution needs to trust something another institution issued.

Today that trust runs through paper and photocopies. Citizens resubmit the same documents to agency after agency. Verifiers either take a document at face value, call the issuing office directly, or send citizens through a separate portal for each check. These processes are difficult to scale consistently, and they do not prevent a document from being altered before it reaches the verifier.

The obvious fix – one national database holding everything – creates a different problem. Whoever operates that database becomes a single point of failure: one breach exposes every citizen, one administrator effectively controls records that used to belong to a dozen separate institutions, and participating agencies may be unwilling to surrender ownership of their data to build it. The bottleneck is not any single agency's ability to issue credentials. It is the absence of a shared way for agencies to trust each other's issuance without merging their databases.

### 1.2 Problem Statement

Bangladesh needs a reusable trust layer through which independent authorities can issue and verify citizen credentials without exposing unnecessary personal information or relying on one organization to own the complete citizen record. The key challenge is not merely storing documents; it is establishing cross-institution trust, proving authenticity, tracking revocation, preserving privacy, and enabling citizens to control what is disclosed.

- **Fragmentation:** Credentials exist across disconnected institutions and verification channels.
- **Repeated KYC and evidence submission:** Citizens repeatedly provide the same facts and documents.
- **Forgery and alteration risk:** Digital images and paper copies can be manipulated or reused.
- **Slow verification:** Manual or portal-by-portal checks increase service time and administrative cost.
- **Excessive disclosure:** A full document may reveal more information than a verifier actually needs.
- **Revocation gap:** A verifier may see a genuine old credential but fail to know that it has been revoked or superseded.
- **Trust concentration:** A single centralized aggregator would become a sensitive control and security point.
- **Coordination without alignment:** Even when agencies agree verification should be easier, no shared incentive structure today rewards them for interoperating rather than protecting their own data silo.

### 1.3 Proposed Solution

CiviLedger aims for a single, consistent verification experience without building a single plaintext database behind it. Each institution stays the source of truth for what it issues: it signs a verifiable credential and hands it to the citizen's wallet. Only minimal verification, status, audit, and governance metadata are stored on-chain; full credential payloads and sensitive personal data remain off-chain. When a verifier receives a citizen-approved presentation, it checks the issuer, the signature, the integrity, the validity window, and the revocation status – nothing more.

The long-term credential scope includes NID/passport reference, birth certificate, academic credentials, professional licences, driving licence, tax/TIN status, government-benefit eligibility, and employment-related credentials. The competition prototype initially implements identity, academic/education, and transport/driving credentials.

### 1.4 Why Blockchain Is Necessary

CiviLedger is intentionally designed around a multi-party trust problem. No single university should control passport verification; no transport authority should control academic credentials; and no private verifier should be able to rewrite government-issued status. A traditional centralized database can store the same data, but it requires all parties to trust the database owner, its administrators, its change history, and its availability.

| Requirement | Centralized Database | CiviLedger Consortium Blockchain |
|---|---|---|
| Cross-agency trust | Requires trust in one database operator. | Shared governance; no single participant can silently rewrite the ledger. |
| Audit history | Administrator-controlled logs can be altered or deleted. | Append-only, tamper-evident transaction history. |
| Issuer autonomy | Data ownership tends to move toward the platform owner. | Each issuer controls its own credentials and endorsement authority. |
| Revocation/status | Requires API trust in each central system. | Common status registry visible to authorized verifiers. |
| Resilience | Central service becomes an outage/control point. | Distributed peers replicate the governed trust layer. |
| Privacy | Central aggregation increases data concentration. | Only minimal verification, status, audit, and governance metadata are stored on-chain; full credential payloads and sensitive personal data remain off-chain. |

*Table 1: Centralized database versus CiviLedger consortium blockchain.*

The centralized-database comparison is not the whole argument. Two other conventional approaches fall short for this problem as well. Federated identity systems such as OAuth or SAML solve login convenience, but they do not give citizens a credential they can hold and present independently – the verifier still needs a live connection back to the identity provider, which breaks down offline or across organizational boundaries. A replicated, cryptographically signed database gets closer to tamper-evidence, but someone still has to administer replication and access policy, which puts control back in one place. For the requirements evaluated here, a permissioned consortium blockchain is better suited to this multi-party governance problem than the centralized and federated alternatives considered, while allowing each institution to retain control over what it issues.

### 1.5 Objectives

The proposed system is designed to address the key challenges associated with digital credential management, verification, privacy, and institutional trust. The main objectives of the project are as follows:

- Create a secure, reusable citizen credential wallet that can hold verified credentials from multiple authorities.
- Enable fast and cryptographic verification of credential authenticity and revocation status.
- Minimize privacy exposure through consent-based minimal disclosure using purpose-specific credentials.
- Build a governed trust network where public and regulated institutions can participate without giving up ownership of their source records. In exchange for adopting a shared standard, each issuer gets a lighter verification workload and stronger fraud protection – the full incentive model appears in Section 2.2.
- Reduce document fraud, duplicate data submission, and manual verification workload.
- Deliver an implementable prototype whose front end interacts with a blockchain back end, as required for the Olympiad.

### 1.6 Representative Use Cases

| Use Case | Citizen Shares | Verifier Confirms |
|---|---|---|
| Job application | Degree credential + identity proof | Institution, degree, graduate identity, validity |
| Driving-related service | Driving-license credential | License class, validity, revocation status |
| Age-restricted service | Purpose-specific age-over-threshold credential | Eligibility without exposing full birth date |
| Bank / regulated onboarding | Identity reference + requested attributes | Issuer authenticity and current status |
| Government benefit application | Eligibility credential | Eligibility class/status without unrelated records |
| Tax-related process | Tax/TIN status credential | Active/valid status and issuer |
| International education/employment | Academic credential presentation | Signature, issuer, integrity and status via QR/API |

*Table 2: Representative use cases across the credential ecosystem.*

---

## 2. Market and Partners

### 2.1 Market Scope

CiviLedger is designed as shared digital infrastructure rather than a consumer application for a single service. Its potential market therefore includes both sides of credential verification: institutions that issue trusted credentials and organizations that need to verify them.

On the citizen side, the addressable base is already large. The Bangladesh Election Commission reported more than 12.77 crore registered voters in 2026, which gives a useful indication of the scale of the adult identity-credential population alone [1]. The platform can also support credentials outside the voter population, including academic, birth, professional, and benefit-related records.

The institutional market is similarly broad. Potential issuers include identity authorities, education boards and universities, transport authorities, tax and licensing bodies, and benefit agencies. Potential verifiers include employers, banks and other regulated service providers, educational institutions, government offices, and organizations that currently rely on paper documents or separate issuer portals. These use cases are already reflected in the project's proposed credential set, which includes identity, academic, driving, tax, benefit, and employment-related credentials.

For the competition prototype, however, CiviLedger does not attempt to represent this entire market at once. The initial network is deliberately limited to three simulated issuer organizations: an identity authority, an education authority, and a transport authority. This matches the three-organization validator model used in the proposed architecture.

This is also a practical entry point. Bangladesh's official Education Boards portal, for example, lists nine Boards of Intermediate and Secondary Education responsible for public examinations and related academic records, showing that even one credential domain already involves several independent issuing institutions rather than a single database owner [2].

A precise national revenue forecast would be premature because public data on cross-agency verification volume and manual verification cost are fragmented. Instead of inventing a large market figure, the pilot will measure actual verification volume, processing time, and institutional cost per verification. Those measurements can then provide a defensible basis for later revenue projections.

### 2.2 Ecosystem Partners and Incentives

CiviLedger only works if the organizations that issue, verify, and govern credentials have a clear reason to participate. The platform therefore treats partner incentives as part of the network design rather than assuming that institutions will join simply because the technology exists.

**Credential issuers** are the authorities that remain responsible for the records they already own. Examples include an identity authority, education boards or universities, the transport authority, licensing bodies, and other public or regulated institutions. They do not hand their source databases to CiviLedger. Instead, they sign credentials and anchor only the necessary integrity and status information to the association ledger. Their incentive is a lower manual verification burden, better protection against altered documents, and the ability to revoke or supersede credentials through a common status mechanism.

**Verifiers** include employers, banks, educational institutions, government service providers, and other organizations that need to confirm a citizen's claim. Their incentive is faster verification through one common mechanism instead of integrating separately with every issuer. The prototype supports both QR-based verification and an API path so that an organization can test the service before undertaking a deeper integration.

**Citizens** hold the credentials and decide what to present. Their value comes from reusability, fewer repeated document submissions, faster verification, and reduced unnecessary disclosure. The proposed architecture keeps full credential payloads and sensitive personal information off-chain while using the blockchain for proofs, status, consent/audit metadata, and governance events.

**Oversight and regulatory bodies** provide governance legitimacy rather than issuing every credential themselves. The architecture includes an OVERSIGHT role that can review governance and audit events without gaining the authority to issue credentials or automatically access citizens' off-chain personal data.

These incentives are implemented through the blockchain network itself rather than through a speculative token. Verified issuers receive role-gated issuance and status-update rights, verifiers receive trusted access to the common verification mechanism, and oversight participants receive auditable governance visibility. Membership and role assignment are governed on-chain so that no single institution can grant itself authority over another institution's credential domain.

Citizen identity and credentials are intentionally not tokenized as transferable assets. The project treats credentials as governed, non-transferable records rather than financial products.

---

## 3. Competition and Risks

This section sets out the direct and indirect competitive landscape for CiviLedger, followed by the business and technical risks identified for the project, together with the mitigation adopted for each.

### 3.1 Competitive Landscape

Direct competition includes any product or service that attempts to solve cross-institutional credential verification through technology. This includes other blockchain-based digital-identity projects (public-chain identity DApps, other national digital-ID initiatives). Indirect competition includes the status quo processes CiviLedger is designed to replace: paper/scanned documents, separate issuer portals that verifiers must integrate with one at a time, and a hypothetical single centralized citizen database.

| Alternative | Strength | Limitation vs. CiviLedger |
|---|---|---|
| Paper / scanned documents | Simple, familiar, no technology adoption barrier | Easy to alter; slow manual validation; forces over-disclosure of full documents |
| Separate issuer portals | Authoritative source check at the point of issuance | Fragmented experience; every verifier must integrate separately with every issuer |
| Single centralized citizen database | Operationally simple to query | Single control/breach point; forces institutions to surrender ownership of their own records |
| Public-chain identity DApps | Open verification, high decentralization | Public metadata visibility conflicts with citizen privacy; weak fit for regulated institutional membership and permissioning |

*Table 3: Competitive landscape and CiviLedger's differentiation.*

CiviLedger's differentiated position is the combination of issuer autonomy (no institution surrenders its records), citizen-controlled disclosure, and a permissioned governance model suited to regulated public institutions. These are combinations none of the above alternatives offer together.

### 3.2 Business Risks and Mitigations

As with any multi-party platform, the greatest risks to CiviLedger are business and adoption risks rather than purely technical ones, since the value of the network depends on institutions actually choosing to participate.

| Risk | Likelihood | Mitigation |
|---|---|---|
| Institutions decline to join the association | Medium–High | Start with a minimal 3-organization demo association (NID authority, education board, transport authority) matched to 3 credential types. Proving the workflow end-to-end before asking any institution to commit resources and expand only after demonstrated savings. |
| Incentive misalignment between issuers and verifiers | Medium | Every governance checklist role (Section 4.7) ties directly to a concrete institutional benefit. Reduced manual verification load for issuers, faster onboarding for verifiers; stated explicitly in Section 2 rather than left implicit. |
| Lack of business traction / low verifier adoption | Medium | Free/basic verification API access for early verifiers, plus a simple QR-based verification flow that does not require a verifier to build custom integration before seeing value. |
| Citizen digital exclusion (no smartphone/literacy barriers) | Medium | Assisted-service points and printable/QR proofs are identified as a required accessibility feature for any real deployment, disclosed explicitly rather than assumed away from the prototype. |
| Policy/legal uncertainty around credential issuance authority | Medium | Prototype uses simulated issuer organizations rather than claiming real regulatory authority; a legal/compliance review is scoped as a required Phase 2 pilot activity, not assumed complete. |

*Table 4: Business risks, likelihood, and mitigation.*

### 3.3 Technical Risks and Mitigations

The technical risks below focus specifically on where the solution could underperform or fail on execution grounds, independent of adoption risk.

| Risk | Mitigation |
|---|---|
| Citizen wallet key loss | Device-bound keys with a defined re-proofing and reissuance flow. The citizen re-establishes identity through an approved process. The lost key is revoked on-chain via the IssuerRegistry/Governance contracts, then the credentials are reissued rather than being permanently lost. |
| Smart contract bugs in Solidity | Contracts scoped to minimal, auditable logic (role-gated registry and status functions rather than complex financial logic). Built on audited OpenZeppelin AccessControl primitives rather than custom permission code. Tested with Hardhat's test suite before deployment to the shared network. |
| On-chain metadata enabling citizen activity correlation | Only credential hashes, issuer IDs, and status are stored. Never full claim payloads or stable cross-service citizen identifiers are written on-chain, limiting what a network observer could correlate (see Section 4.5). |
| Validator node outage (single organization's node down) | IBFT 2.0 consensus tolerates faulty/offline validators up to the standard Byzantine fault threshold; the network continues operating and finalizing transactions as long as a supermajority of the remaining validator organizations are online. |
| Selective disclosure is simplified, not full zero-knowledge proof | The prototype deliberately uses purpose-specific minimal credentials (Section 4.6) rather than claiming zero-knowledge selective disclosure. This is disclosed as a scoped simplification with true attribute-level selective-disclosure cryptography identified as future work. |

*Table 5: Technical risks and mitigation.*

---

## 4. Architecture and Governance

This section sets out CiviLedger's technical architecture and its governance model, addressing platform choice, on-chain/off-chain design, legacy system integration, the governance checklist, and the project's position on asset tokenization.

### 4.1 Architecture Choice and Platform Justification

CiviLedger is built on a permissioned, EVM-compatible consortium blockchain, **Hyperledger Besu**, configured with **IBFT 2.0** (Istanbul Byzantine Fault Tolerant) consensus, rather than a public chain or a non-EVM permissioned framework such as Hyperledger Fabric. Three factors drove this choice:

- **Governance fit:** Participants are known, accountable institutions (the Identity Authority, Education Authority, and Transport Authority) and not anonymous public actors. So, a permissioned network with defined validator organizations is required, exactly as a public chain would not provide.
- **Solidity as the smart-contract language:** An EVM-compatible permissioned network allows the full governance and credential logic to be written in Solidity. This can be tested with the Hardhat toolchain and deployed unmodified to a production-like permissioned network, keeping the team's development skillset and the deployment target aligned.
- **IBFT 2.0 finality:** As a practical-BFT consensus mechanism suited to a small, known validator set, it gives fast, deterministic transaction finality. This is appropriate for a credential-status registry that must not fork or leave a status update ambiguous.

This is a deliberate architecture decision distinct from the Fabric-based design considered earlier in this project's planning. Fabric offers private data collections as a built-in primitive, whereas the Besu/Solidity approach keeps all sensitive data off-chain entirely (Section 4.5), using the EVM ledger purely for hashes, status, and governance events. Both approaches satisfy the underlying privacy requirement; the Besu/Solidity path was selected for its direct fit with the team's Solidity development track and its simpler, more widely documented tooling for a permissioned consortium of this size.

### 4.2 Smart Contract Architecture

Governance and credential logic are implemented as a small set of Solidity contracts, deployed identically across all validator nodes and built on OpenZeppelin's AccessControl library for role-based permissioning rather than custom access-control code.

| Contract | Core Functions |
|---|---|
| `IssuerRegistry.sol` | `registerIssuer()`, `updateIssuerStatus()`, `rotateIssuerKey()`, `getIssuer()` – role-gated to the Governance contract |
| `CredentialRegistry.sol` | `issueAnchor()`, `getAnchor()`, `verifyAnchor()`, `supersedeCredential()` – callable only by the registered issuer for a given credential type |
| `CredentialStatus.sol` | `suspend()`, `reactivate()`, `revoke()`, `getStatus()` – issuer-gated status transitions with emitted events for off-chain indexing |
| `ConsentAudit.sol` | `recordConsentHash()`, `recordPresentationReceipt()`, `queryCitizenAudit()` – append-only consent/audit event log |
| `Governance.sol` | `proposeMember()`, `approveMember()`, `suspendMember()`, `updatePolicy()` – OpenZeppelin AccessControl roles: ADMIN, ISSUER, VERIFIER, OVERSIGHT |

*Table 6: Smart contract suite and core functions.*

Role assignment (which address holds ADMIN, ISSUER, VERIFIER, or OVERSIGHT rights) is itself an on-chain governance action controlled by the Governance contract, so no single validator organization can unilaterally grant itself issuance rights over another institution's credential type.

### 4.3 System and Network Architecture

The full system consists of a React-based client layer for the three user-facing roles, a thin application layer bridging the frontend to the blockchain via ethers.js, the permissioned Besu consortium network running the Solidity contracts, and the off-chain layer holding all sensitive data.

- **Client layer:** Three React (TypeScript) applications – Citizen Wallet, Issuer Dashboard, Verifier Portal; sharing common component/design patterns but serving distinct roles.
- **Application layer:** A Node.js/Express API handles orchestration and authentication, while ethers.js manages all read/write calls to the Solidity contracts on the Besu network.
- **Blockchain layer:** Three validator/issuer nodes (Identity Authority, Education Authority, Transport Authority) running Hyperledger Besu in IBFT 2.0 mode, each hosting an identical copy of the deployed contract suite.
- **Off-chain layer:** Encrypted per-issuer document/attribute storage, a PostgreSQL database for application metadata, and a separate key-management component for citizen and issuer keys.

> **Figure 1 — System and Consortium Network Architecture:** A minimal 3-organization validator set comprising the simulated Identity Authority, Education Authority, and Transport Authority, matched to the identity, education, and transport prototype credentials. The deployed contract suite comprises `IssuerRegistry.sol`, `CredentialRegistry.sol`, `CredentialStatus.sol`, `ConsentAudit.sol`, and `Governance.sol`.
>
> Flow: **Client Layer** (Citizen Wallet / Issuer Dashboard / Verifier Portal) → **Application Layer** (Node.js/Express API ↔ ethers.js) → **Blockchain Layer** (NID/Passport Authority Node, Education Board/University Node, Transport Authority (BRTA) Node — connected via IBFT 2.0 consensus, running the Solidity smart contracts) → **Off-Chain Layer** (Encrypted Document/Attribute Store, PostgreSQL, Key Management).

### 4.4 Credential Lifecycle

> **Figure 2 — Credential Lifecycle:** Issue → Anchor → Hold → Share → Verify, with issuer-initiated Revoke/Supersede available at any point after anchoring.
>
> 1. **Issue** – Issuer verifies the source record and signs the credential.
> 2. **Anchor** – Hash + status written to the permissioned blockchain.
> 3. **Hold** – Citizen stores the credential in their wallet (e.g., DID).
> 4. **Share** – Citizen consents and shares the minimum required claims.
> 5. **Verify** – Verifier checks signature, issuer, integrity, and status.
> - **Revoke/Supersede** (if triggered at any time after anchoring) – Issuer updates status; future verifications fail.

### 4.5 On-Chain vs. Off-Chain Data

| Stored On-Chain | Stored Off-Chain |
|---|---|
| Credential identifier/hash | Full credential payload and underlying documents |
| Issuer address/organization ID | NID/passport numbers, unless a protected reference is required |
| Credential type and schema version | Address, phone, email, family details |
| Issue timestamp/expiry metadata | Document scans, attachments, biometrics |
| Active/suspended/revoked status | Detailed academic, tax, employment, or benefit records |
| Consent-event hash/audit metadata | Encryption keys and secrets |
| Governance and membership events | Any data whose deletion/rectification rights conflict with an immutable ledger |

*Table 7: On-chain versus off-chain data split.*

### 4.6 Digital Identity and Purpose-Specific Minimal Disclosure

Each citizen is represented by a Decentralized Identifier (DID) and a device-bound key pair managed by the Citizen Wallet application. Each issuer is represented by an on-chain address registered through `IssuerRegistry.sol`. For the prototype, purpose-specific minimal disclosure is implemented through purpose-specific minimal credentials rather than full zero-knowledge cryptography (e.g., BBS+ signatures). An issuer can sign a narrowly scoped credential (for example, an "is-above-18" claim rather than a full birth date) alongside the complete credential, and the citizen chooses which version to share for a given verification request. This is a deliberate, disclosed simplification appropriate for a working prototype.

### 4.7 Legacy System Integration

CiviLedger does not replace any institution's authoritative source database. Each issuer's dashboard connects to its own existing internal record system through a thin adapter, checks the source record first, and only then signs a credential and writes the minimal registry proof to the blockchain via its IssuerRegistry-registered address. This allows an institution to adopt the system incrementally while keeping its internal systems unchanged, adding a standards-based issuance and verification layer on top.

### 4.8 Governance Checklist

**Network Membership Governance**

- **Member on and off-boarding:** New issuer organizations are admitted through a `Governance.sol` `proposeMember()`/`approveMember()` flow requiring multi-organization approval. Offboarding revokes the organization's on-chain role and rotates any keys it controls.
- **Regulatory oversight provisioning:** An OVERSIGHT role (held by a designated auditor) has read access to all governance and audit events without gaining issuance or citizen-data access rights.
- **Permission structure:** Role-based access control (ADMIN, ISSUER, VERIFIER, OVERSIGHT) enforced at the smart-contract level via OpenZeppelin AccessControl, so permissions are enforced by the network itself, not by application-layer trust.
- **Network operations:** Each of the three demo validator organizations runs its own Besu node. In a production network additional organizations would each operate their own node rather than relying on a shared operator.

**Business Network Governance**

- **Business charter and operations structure:** An association agreement defines which organizations may hold validator/issuer status.
- **Common services management:** The Node.js/Express application layer and verification API are operated as a shared service on behalf of the association, not owned by any single member institution.
- **Business SLA and regulatory compliance:** Credential-status update latency and node-uptime expectations are defined according to the association charter, with compliance monitored by the OVERSIGHT role.

**Technology Infrastructure Governance**

- **Distributed IT structure:** No single organization hosts the canonical ledger. Each validator organization runs its own Besu node, with contract state replicated via IBFT 2.0 consensus.
- **Technology assessment and adoption:** New contract versions are tested on a staging network and require association sign-off (via `Governance.sol`) before deployment to the production validator set.
- **On-chain and off-chain data services:** Enforced by the split defined in Section 4.5, with periodic reconciliation between an issuer's off-chain record store and its on-chain credential anchors.
- **Risk mitigation:** After approved identity re-proofing, a citizen receives a new wallet, DID, and device-bound key pair. Issuers revoke the old credentials through `CredentialStatus.sol` and reissue them to the new wallet/DID, consistent with the technical risk mitigations in Section 3.3.

### 4.9 Digital Asset / Tokenization Position

Citizen identity and credentials are not treated as tradable digital assets. CiviLedger deliberately avoids issuing transferable identity tokens. A credential anchor on-chain is a non-transferable registry record linked to a signed verifiable credential, not an ERC-20/ERC-721-style asset that could be sold or transferred to another citizen. This is an intentional architectural constraint enforced by omitting any transfer function from `CredentialRegistry.sol`, preventing inappropriate financialization of identity while still treating credential state as a governed, auditable on-chain object.

### 4.10 Technology Stack Summary

| Component | Technology |
|---|---|
| Blockchain platform | Hyperledger Besu, IBFT 2.0 consensus |
| Smart contracts | Solidity, built on OpenZeppelin AccessControl; developed and tested with Hardhat |
| Blockchain connectivity | ethers.js |
| Frontend | React + TypeScript (Citizen Wallet, Issuer Dashboard, Verifier Portal) |
| Backend/API | Node.js/Express, REST/JSON APIs |
| Credential format | W3C Verifiable Credential-compatible JSON; purpose-specific minimal credentials for minimal disclosure |
| Application database | PostgreSQL |
| Off-chain storage | Encrypted per-issuer document/attribute store |
| Deployment | Docker Compose for a reproducible local/cloud demo network |
| Version control | GitHub (public repository, per competition requirement) |

*Table 8: Technology stack for the prototype and its defined production path.*

---

## 5. Revenue and Distribution

### 5.1 Value Creation

CiviLedger creates value mainly by reducing the cost and friction of trust between institutions. For issuers, the platform can reduce repeated calls, emails, manual document checks, and portal-specific verification requests. For verifiers, it provides a common way to check issuer authenticity, credential integrity, validity, and revocation status. For citizens, it reduces repeated evidence submission and allows a narrower set of information to be shared when the complete underlying document is unnecessary.

These benefits directly address the fragmentation, slow verification, forgery risk, excessive disclosure, and revocation problems identified in Section 1.

The platform therefore does not need to create value by selling citizen data or issuing a cryptocurrency. Its economic value comes from reducing verification effort, shortening service time, lowering document-fraud exposure, and providing shared infrastructure that participating institutions do not each have to build independently.

### 5.2 Revenue Model

The proposed business model is institution-funded. Basic credential holding and citizen-controlled presentation should remain free to citizens so that individual adoption is not discouraged. Revenue can come from three complementary sources.

- **Institutional membership and network fees:** Issuer or validator organizations can contribute an annual membership fee toward shared association infrastructure, governance operations, monitoring, and common services.
- **Verification API plans:** Early verifiers can receive free or basic access to demonstrate value, consistent with the adoption strategy already identified in the project risk analysis. Higher-volume organizations can later move to paid API plans based on verified usage or service-level requirements.
- **Integration and managed infrastructure services:** Institutions that need legacy-system adapters, managed node hosting, technical integration, key-management support, or higher service guarantees can pay implementation and support fees. This is particularly relevant because CiviLedger is designed to sit above existing institutional databases rather than replace them.

This model avoids speculative token economics and ties revenue directly to measurable institutional value. The exact fee levels should not be fixed before a pilot. During the pilot, the team will measure verification volume, time saved, integration cost, and operational demand. Those figures will be used to determine sustainable membership and API pricing.

### 5.3 Distribution and Rollout

The rollout is intentionally phased so that CiviLedger can demonstrate value before asking a large number of public institutions to join.

- **Phase 1 – Competition prototype:** Build the complete workflow with three simulated issuer/validator organizations representing identity, education, and transport. The prototype will demonstrate issuance, blockchain anchoring, citizen-held credentials, consent-based sharing, verification, and revocation through a working front end and blockchain back end.
- **Phase 2 – Focused pilot:** Select one high-frequency verification corridor, such as academic credential verification between an issuer and a small group of employers or other verifiers. At this stage, the project would also require a formal legal, privacy, and regulatory review before handling real citizen credentials. The pilot should measure verification time, failure rate, user experience, and institutional workload rather than attempting immediate nationwide deployment.
- **Phase 3 – Association expansion:** After a successful pilot, additional issuer and verifier organizations can be admitted through the network's governed membership process. Shared APIs and legacy-system adapters allow institutions to join without replacing their internal databases. Governance, onboarding, permissions, and oversight remain controlled through the association structure already defined in Section 4.
- **Phase 4 – Wider credential coverage:** Once the trust network is stable, additional credential types such as professional licences, tax/TIN status, benefit eligibility, and employment credentials can be added through a governed schema process. This follows the extensibility already defined in the proposed solution rather than introducing all credential types in the first deployment.

The distribution strategy is therefore based on proving value in one real verification workflow, expanding the consortium through existing institutional relationships, and adding new credential types only after the governance and technical model has been validated.

---

## References

1. Bangladesh Election Commission. *Registered Voter Statistics*, 2026. https://ecs.gov.bd/en. Accessed 17 August 2026.
2. Ministry of Education. *Education Board Bangladesh: Official board information*, n.d. https://www.educationboard.gov.bd/. Accessed 17 August 2026.

---

*Team HexaMind | United International University*
