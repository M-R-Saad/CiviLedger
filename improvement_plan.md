# CiviLedger — Improvement Plan

> Organized by priority. Pick what matters most for your next milestone.

---

## 🔴 TIER 1: Critical — Things Judges / Evaluators Will Notice

These are things that make your project look incomplete if missing.

---

### 1.1 Landing Page (No page exists at `/`)

**Current:** Going to `localhost:5173` just redirects to `/login`. There's no landing page explaining what CiviLedger is.

**What to build:** A public landing page with:
- Hero section: "Decentralized Credential Verification for Citizens"
- 3-column feature cards (Tamper-proof, Citizen-controlled, Instant verification)
- "How it works" section with a 4-step visual (Issue → Hold → Share → Verify)
- Role-specific entry buttons: "I'm an Institution" → Login, "I'm a Citizen" → Connect Wallet, "I'm a Verifier" → Verify a Credential
- Architecture diagram preview

**Why:** First impression matters. Judges landing on the app should immediately understand what it does before seeing a login form.

**Effort:** ~2 hours

---

### 1.2 Credential Detail View (Missing page)

**Current:** The Issuer Dashboard shows a table with truncated UUIDs. Clicking "Manage" jumps straight to Suspend/Revoke. There's no page to actually **view** what's in a credential.

**What to build:** A `/issuer/credential/:id` detail page showing:
- Full credential payload rendered nicely (Institution, Degree, GPA, etc.)
- On-chain anchor info (anchor ID, issuer address, tx hash)
- Status history (all status change events with timestamps)
- Citizen info (name, wallet address)
- A button to manage (suspend/revoke) from this page

Same for citizens: a `/citizen/credential/:id` detail page.

**Why:** Judges will want to see *what's inside* a credential. Right now they can only see truncated IDs in a table.

**Effort:** ~1.5 hours

---

### 1.3 Presentation Expiry Enforcement

**Current:** Presentations expire after 15 minutes (`expires_at`), and the verifier controller checks this. But the citizen AuditHistory shows "Active/Expired" status. However, a verifier pasting the token after expiry gets a 410 error with no friendly message.

**What to build:**
- Citizen should be able to **re-share** (generate a new link)
- Allow configurable expiry time (15 min, 1 hour, 24 hours)
- Show clear "This presentation has expired" message on verifier side

**Effort:** ~1 hour

---

### 1.4 Dashboard Stats Cards

**Current:** All dashboards jump straight into tables/forms. No overview or summary.

**What to build:** At the top of each dashboard:

**Issuer Dashboard:**
- Total credentials issued (count)
- Active / Suspended / Revoked breakdown
- Recent activity timeline

**Oversight Dashboard:**
- Total organizations in network
- Total governance events
- Active vs. Pending orgs

**Citizen Wallet:**
- Total credentials held
- Active vs. Expired
- Times shared count

**Verifier Portal:**
- Total verifications performed
- Valid vs. Invalid breakdown

**Why:** Makes dashboards feel like real operational tools, not just forms.

**Effort:** ~2 hours

---

## 🟠 TIER 2: High — Features the Whitepaper Promises

These are things you explicitly claim in the whitepaper but haven't built yet.

---

### 2.1 Purpose-Specific Minimal Credentials (Section 4.6)

**Current:** The DB model `PurposeSpecificCredential` exists with fields `source_credential_id`, `claim_key`, `claim_value`. But no API endpoint creates or uses them.

**What to build:**
- When an issuer issues an identity credential, the system auto-generates:
  - An `is_above_18` credential (derived from `date_of_birth`)
  - A `nationality_only` credential (just nationality, no name/DOB)
- Citizen can choose to share the purpose-specific version instead of the full credential
- Verifier sees "Purpose-specific credential" badge and only the disclosed fields

**Why:** The whitepaper says *"An issuer can sign a narrowly scoped credential (for example, an 'is-above-18' claim)"*. This is the privacy feature that differentiates you.

**Effort:** ~3-4 hours

---

### 2.2 Supersede Credential (`supersedeCredential()` — Section 4.2)

**Current:** Missing from smart contract.

**What to build:**
- Add `supersedeCredential(oldAnchorId, newAnchorId)` to `CredentialRegistry.sol`
- When an issuer issues an updated credential (e.g., name change), the old one is marked superseded on-chain
- Verifier checking the old credential sees "SUPERSEDED — replaced by newer credential"

**Why:** Real-world use case: someone legally changes their name, their old ID credential needs to be superseded (not revoked — that implies fraud).

**Effort:** ~2 hours

---

### 2.3 Issuer Key Rotation (`rotateIssuerKey()` — Section 4.2)

**Current:** Missing from smart contract.

**What to build:**
- Add `rotateIssuerKey(oldAddress, newAddress)` to `IssuerRegistry.sol`
- Governance event logged when key is rotated
- All future issuances use the new key

**Why:** Security hygiene. If an issuer's private key is compromised, they need to rotate without losing their credential history.

**Effort:** ~1.5 hours

---

### 2.4 QR Code Scanning (Mentioned in whitepaper Table 2)

**Current:** The verifier page just has a text input. No camera-based QR scanning.

**What to build:**
- Add `react-qr-reader` or `html5-qrcode` library to the verifier portal
- Camera viewfinder on the verification page
- Scanning the citizen's QR code auto-fills the token and starts verification

**Why:** This is a "wow" demo moment — the verifier literally scans a code and gets instant blockchain verification. Much better than pasting a text token.

**Effort:** ~1 hour

---

## 🟡 TIER 3: Medium — Polish & Professional Quality

---

### 3.1 Proper Navbar with Role Indicator

**Current:** There's an AppShell but let me check what it looks like — it might be minimal. The user has to know which account they're logged in as.

**What to build:**
- Persistent top navbar showing: CiviLedger logo, current user name, role badge (color-coded), and logout button
- Sidebar or tab navigation within each role:
  - Citizen: My Credentials | Share | History
  - Issuer: Issued | Issue New | Manage
  - Verifier: Verify | History
  - Oversight: Organizations | Audit Log

**Effort:** ~1.5 hours

---

### 3.2 Verification Certificate / Report

**Current:** Verifier sees a VALID/REVOKED banner. No exportable proof.

**What to build:**
- After verification, generate a **Verification Certificate** — a styled card showing:
  - Credential type, issuer, status
  - Verification timestamp
  - On-chain receipt transaction hash
  - A "Download PDF" or "Print" button
- This is the artifact the verifier keeps for their records

**Why:** In a real workflow, the HR manager needs something to put in the employee's file.

**Effort:** ~2 hours

---

### 3.3 Notification / Toast System

**Current:** After actions (issue credential, revoke, share), the user gets redirected or sees an inline message that's easy to miss.

**What to build:**
- Toast notification system (bottom-right corner)
- "✅ Credential issued successfully — anchored on-chain" with tx hash
- "⚠️ Credential revoked — status updated on-chain"
- "📋 Share link copied to clipboard"

**Effort:** ~45 minutes

---

### 3.4 Testnet Deployment (Polygon Amoy)

**Current:** Everything runs on local Hardhat node.

**What to build:**
- Deploy contracts to Polygon Amoy testnet
- Link transaction hashes to Polygonscan so judges can verify on a public blockchain explorer
- Add a "View on Polygonscan" link next to every tx hash in the UI

**Why:** Judges can independently verify that your blockchain claims are real by clicking a link to a public explorer.

**Effort:** ~1-2 hours (just change RPC URL + deploy)

---

### 3.5 Proper Backend Signature Verification

**Current:** The `walletLogin` endpoint trusts the client-sent wallet address without verifying a signature. The comment says: *"Harden this with a real challenge/response signature check"*.

**What to build:**
- Backend generates a random nonce for the citizen
- Citizen signs the nonce with MetaMask
- Backend verifies the signature with `ethers.verifyMessage(nonce, signature)` before creating the session

**Why:** Without this, anyone can impersonate any citizen by sending any wallet address. Not a problem for a demo, but a real security gap.

**Effort:** ~1 hour

---

## 🟢 TIER 4: Nice-to-Have — Impressive But Not Essential

---

### 4.1 Multi-Language Support (Bengali / English)

**Current:** The VerificationResult page already uses an i18n system (`useT()`, `t()` function). But most other pages use hardcoded English.

**What to build:** Extend the i18n system to all pages. Add Bengali translations. Language toggle in the navbar.

**Why:** The whitepaper is about Bangladesh. Having Bengali in the UI shows attention to real-world deployment.

**Effort:** ~3 hours

---

### 4.2 Dark Mode

**Current:** Light theme only.

**Why:** Looks premium. Judges appreciate polish.

**Effort:** ~2 hours

---

### 4.3 Credential Schema Validation

**Current:** The issuer can type anything into the payload fields. No validation.

**What to build:** Use the `json_schema` from `credential_types` to validate:
- Required fields are filled
- `date_of_birth` is a valid date
- `gpa` is a number between 0-4
- `license_number` matches a pattern

**Effort:** ~1.5 hours

---

### 4.4 Audit Log Enhancements

**Current:** The oversight audit log shows governance events and credential status events in separate tables.

**What to build:**
- Unified timeline view with all event types
- Filtering by: event type, organization, date range
- Export to CSV

**Effort:** ~2 hours

---

### 4.5 Document Upload Support

**Current:** `documents` table exists in the schema but upload logic isn't built.

**What to build:** Allow issuers to attach supporting documents (PDFs, images) to credentials. Stored off-chain only.

**Effort:** ~2 hours

---

## 🗺️ Suggested Execution Order

If you have limited time, do these in this order:

| Priority | Item | Time | Impact |
|----------|------|------|--------|
| 1st | Landing Page (1.1) | 2h | Huge first impression |
| 2nd | Dashboard Stats Cards (1.4) | 2h | Makes app feel complete |
| 3rd | Credential Detail View (1.2) | 1.5h | Judges will look for this |
| 4th | QR Code Scanning (2.4) | 1h | "Wow" demo moment |
| 5th | Purpose-Specific Credentials (2.1) | 3h | Key whitepaper promise |
| 6th | Verification Certificate (3.2) | 2h | Professional quality |
| 7th | Notification / Toasts (3.3) | 45m | Polish |
| 8th | Testnet Deployment (3.4) | 1.5h | Judges can verify independently |
| 9th | Presentation Expiry UX (1.3) | 1h | Completeness |
| 10th | Supersede Credential (2.2) | 2h | Whitepaper compliance |

**Total for top 10:** ~17 hours of work

---

## ⚠️ Things We Avoided (And Why)

| What we skipped | Why | Risk if judges ask |
|---|---|---|
| **3 separate Besu nodes** | Same contract logic, different infra. Hardhat is standard for prototypes. | Low — explain as justified simplification |
| **Real MetaMask for citizen login** | Adds setup friction. Demo works without it. | Medium — we should at least support it as an option |
| **BBS+ zero-knowledge proofs** | Whitepaper's own fallback says purpose-specific credentials are OK | Low — whitepaper explicitly allows this |
| **Encrypted off-chain storage** | Would need a key management system | Low — "future work" is acceptable |
| **Multi-party approval for governance** | Only admin can approve currently | Medium — whitepaper implies "multi-organization approval" |
| **DID resolution** | We store `did:ethr:0x...` but don't resolve it | Low — the DID format is correct, resolution is infrastructure |

---

## 💡 My Recommendation

For your **next session**, focus on **Tier 1** (Critical items 1.1-1.4). These are the things that make the difference between "student prototype" and "professional demo":

1. **Landing page** — First impression
2. **Credential detail view** — Judges want to see inside credentials
3. **Dashboard stat cards** — Makes it feel like a real product
4. **QR code scanning** — "Wow" moment during demo

After that, tackle **2.1 (Purpose-Specific Credentials)** — it's the most impressive whitepaper feature you haven't built yet, and it directly demonstrates the privacy story.

What do you want to prioritize?
