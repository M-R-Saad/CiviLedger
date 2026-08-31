# CiviLedger

A consortium-blockchain credential verification prototype (BCOLBD 2026).

## Workspaces
- `contracts/` — Solidity smart contracts (Hardhat)
- `backend/` — Express API + PostgreSQL + ethers.js bridge to the blockchain
- `frontend/` — React + TypeScript (Vite) client, role-based UI (Citizen / Issuer / Verifier / Oversight)
- `docs/` — project documentation (overview, schema, structure, workflow)

## Quick Start

### 0. Prerequisites
- Node.js 18+
- PostgreSQL running locally (or use SQLite — see `backend/.env.example`)
- MetaMask browser extension

### 1. Install dependencies (each workspace)
```bash
cd contracts && npm install
cd ../backend && npm install
cd ../frontend && npm install
```

### 2. Start a local blockchain
```bash
cd contracts
npx hardhat node
```
Leave this running in its own terminal — it's your local Ethereum network with 20 pre-funded test accounts.

### 3. Deploy contracts (in a second terminal)
```bash
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```
This writes contract addresses to `contracts/deployments/localhost.json` and copies ABIs into `backend/src/contracts-abi/`.

### 4. (Optional) Seed demo data
```bash
npx hardhat run scripts/seed-demo-data.js --network localhost
```

### 5. Configure and start the backend
```bash
cd ../backend
cp .env.example .env   # edit DB credentials
npm run migrate        # create tables
npm run dev
```

### 6. Configure and start the frontend
```bash
cd ../frontend
cp .env.example .env
npm run dev
```

Then open http://localhost:5173, connect MetaMask (pointed at "Hardhat Local" network, chain ID 31337), and follow `docs/04_WORKFLOW.md`.

## Adding Hardhat Local Network to MetaMask
- Network name: Hardhat Local
- RPC URL: http://127.0.0.1:8545
- Chain ID: 31337
- Currency symbol: ETH

Import one of the private keys printed by `npx hardhat node` into MetaMask to get test ETH.

## Docs
See the `docs/` folder for the full project overview, DB schema, folder structure rationale, and step-by-step build workflow.
