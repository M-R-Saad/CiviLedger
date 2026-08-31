# CiviLedger — Live Demo Script

> Follow this script exactly during the demo. Nothing is improvised — every click is planned. 
> Total demo time: **~8 minutes**

---

## Pre-Demo Setup (do before judges arrive)

```powershell
# Terminal 1: Start PostgreSQL
docker compose up -d

# Terminal 2: Start blockchain
cd contracts
npx hardhat node

# Terminal 3: Deploy contracts + seed on-chain data
cd contracts
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/seed-demo-data.js --network localhost

# Terminal 4: Migrate + seed database, then start backend
cd backend
npx sequelize-cli db:migrate:undo:all
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
node src/index.js

# Terminal 5: Start frontend
cd frontend
npm run dev
```

Open browser to **http://localhost:5173/login**

---

## ACT 1: "The Problem" (30 seconds — narrate only)

> *"Today, credential verification is fragmented. If an employer wants to verify a graduate's degree, they have to call the university, wait days, and hope the person on the other end is honest. If a document has been forged or revoked, there's no reliable way to know. CiviLedger solves this with blockchain."*

---

## ACT 2: Governance — Adding an Organization (1.5 min)

> *"First, let's see how the system is governed. Only approved organizations can issue credentials."*

1. **Click** the demo account button: `🛡️ System Admin (Oversight)` → auto-fills `admin@civiledger.test`
2. **Click** "Log in"
3. You're now on the **Governance Dashboard**

> *"This is the oversight dashboard. You can see the 3 approved issuer organizations — National Identity Authority, Education Authority, and Transport Authority — plus the Employer Corp as a verifier. These were approved on-chain via our Governance smart contract."*

4. **Point out** the Organizations table showing all 4 approved orgs
5. **(Optional demo)** To show the full propose → approve flow, fill in the **Propose New Member** form:
   - **Organization name:** `Bangladesh Medical Council`
   - **On-chain address:** `0xa0Ee7A142d267C1f36714E4a8F75612F20a79720` *(this is Hardhat account #9)*
   - **Type dropdown:** `Issuer`
   - **Click** "Propose Member"
   - The new org appears in the **Pending Approvals** section below
   - **Click** the green "Approve" button next to it

> *"We just proposed a new organization and approved it on-chain. The Governance smart contract recorded this — no single admin can add an organization without the approval transaction being visible to all participants."*

6. **Click** "View Audit Log"

> *"Every governance action — proposals, approvals — is recorded as an immutable event. This audit trail can't be tampered with."*

7. **Click** "Log out"

---

## ACT 3: Issue a Credential (2 min)

> *"Now let's be the Education Authority and issue an academic degree."*

1. **Click** the demo account: `🎓 Education Officer (Issuer)` → auto-fills `nusrat@edu.gov.test`
2. **Click** "Log in"
3. You're on the **Issuer Dashboard** showing previously issued credentials (if any)
4. **Click** "+ Issue New Credential"
5. **Fill in the form:**
   - **Credential type dropdown:** select `Academic Degree Credential`
   - **Citizen:** click the blue "Ahnaf Tahmid" quick-pick button *(auto-fills wallet address)*
   - The credential fields appear automatically:
     - **Institution:** `United International University`
     - **Degree:** `BSc in Computer Science & Engineering`
     - **Graduation Year:** `2026`
     - **GPA:** `3.85`
6. **Click** "Issue Credential"

> *"What just happened: the full credential (name, degree, GPA) was saved in our PostgreSQL database off-chain. Only the keccak256 hash was written to the blockchain via our CredentialRegistry smart contract. The hash proves this exact document was issued — change even one character and the hash won't match."*

7. **Point out** the transaction hash and anchor ID in the response
8. **Click** "Log out"

---

## ACT 4: Citizen Views & Shares (1.5 min)

> *"Now let's switch to the citizen — Ahnaf — who received this degree credential."*

1. Go to the **Login page** (click "Log out" if logged in)
2. **Click** the demo account button: `👤 Ahnaf Tahmid (Citizen)` → auto-fills `ahnaf@citizen.test`
3. **Click** "Log in"
4. You're on the **Citizen Wallet** — the degree you just issued should appear here

> *"The citizen holds their own credentials in a digital wallet. Nobody else — not the government, not the university, not us — can access them without the citizen's explicit consent."*

5. **Click** "Share" on the degree credential
6. The system will:
   - Record a **consent hash on the blockchain** (via ConsentAudit smart contract)
   - Generate a **share link** and a **QR code**

> *"The citizen just consented to share this specific credential. That consent was recorded on the blockchain — creating an immutable audit trail of who shared what, and when."*

7. **Copy the share token** from the URL shown (the part after `/verify/`) — you'll need it in the next step
8. You can also **show the QR code** to the audience

---

## ACT 5: Verifier Checks — ✅ VALID (1 min)

> *"Now the employer — Abrar, an HR manager — wants to verify this degree."*

1. Go back to login page
2. **Click** the demo account: `🔍 HR Manager (Verifier)` → auto-fills `abrar@employer.test`
3. **Click** "Log in"
4. You're on the **Verifier Portal**
5. **Paste** the share token from Act 4
6. **Click** "Verify"

> *"The system just checked the blockchain in real-time. It verified: 
> (1) the hash matches the credential content, 
> (2) the issuer is a registered, active Education Authority, 
> (3) the credential status on-chain is ACTIVE. 
> Result: ✅ VALID."*

---

## ACT 6: The "Wow Moment" — Revocation (1.5 min)

> *"Now here's where blockchain makes the difference. What happens if the university discovers this degree was obtained fraudulently?"*

1. **Click** "Log out"
2. **Click** the demo account: `🎓 Education Officer (Issuer)` → auto-fills `nusrat@edu.gov.test`
3. **Click** "Log in"
4. On the Issuer Dashboard, find the credential you issued
5. **Click** "Manage" → **Click** "Revoke"
6. Enter reason: `"Academic misconduct discovered"`
7. **Confirm** revocation

> *"The revocation was recorded on-chain via our CredentialStatus smart contract. This is permanent and tamper-proof — nobody can undo it, not even the database administrator."*

8. **Click** "Log out"
9. Log back in as the verifier (`abrar@employer.test`)
10. **Paste the same share token** from Act 4
11. **Click** "Verify"

> *"Same token, same credential — but now the result is ❌ REVOKED. The verifier didn't need to call the university. The blockchain told them instantly. This is the core value of CiviLedger: instant, trustless verification with real-time revocation."*

---

## ACT 7: Closing Statement (30 seconds)

> *"To summarize: CiviLedger gives each institution control over its own credentials while providing a shared, tamper-proof verification layer. Personal data stays off-chain for privacy. Only proofs go on-chain. Citizens control what they share. Verifiers get instant answers. And revocation is immediate and permanent."*

---

## Demo Account Reference Card

| Role | Email | Password | What to demo |
|------|-------|----------|-------------|
| 🛡️ Oversight | `admin@civiledger.test` | `password123` | Governance dashboard, audit log |
| 🏛️ NID Issuer | `rahim@identity.gov.test` | `password123` | Issue identity credentials |
| 🎓 Education Issuer | `nusrat@edu.gov.test` | `password123` | Issue academic degrees |
| 🚗 BRTA Issuer | `kamal@brta.gov.test` | `password123` | Issue driving licenses |
| 🔍 Verifier | `abrar@employer.test` | `password123` | Verify presentations |
| 🛡️ Auditor | `auditor@civiledger.test` | `password123` | Alternative oversight account |
| 👤 Citizen 1 (Ahnaf) | `ahnaf@citizen.test` | `password123` | View/share credentials |
| 👤 Citizen 2 (Sumaya) | `sumaya@citizen.test` | `password123` | View/share credentials |
| 👤 Citizen 3 (Shahriar) | `shahriar@citizen.test` | `password123` | View/share credentials |

---

## If Something Goes Wrong

| Problem | Fix |
|---------|-----|
| Login redirects back to login | Clear localStorage: `localStorage.clear()` in console |
| "Nonce too low" blockchain error | Restart Hardhat node + redeploy + reseed |
| Backend can't connect to blockchain | Check that `npx hardhat node` is running on port 8545 |
| Database errors | Run `npx sequelize-cli db:migrate:undo:all` then `db:migrate` then `db:seed:all` |
| MetaMask not connecting | Make sure MetaMask is on "Localhost 8545" network with chain ID 31337 |
