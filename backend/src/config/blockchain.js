const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// DEPLOYMENTS_FILE and CONTRACTS_ABI_DIR may be absolute (Docker: a shared volume the
// contract-deploy step wrote to) or relative to this file (local dev, default layout).
const deploymentsFile = path.resolve(__dirname, process.env.DEPLOYMENTS_FILE || "../../../contracts/deployments/localhost.json");
const abiDir = process.env.CONTRACTS_ABI_DIR
  ? path.resolve(process.env.CONTRACTS_ABI_DIR)
  : path.resolve(__dirname, "..", "contracts-abi");

if (!fs.existsSync(deploymentsFile)) {
  console.warn(
    `[blockchain.js] No deployments file found at ${deploymentsFile}. Run "npx hardhat run scripts/deploy.js --network localhost" in contracts/ first.`
  );
}

const deployment = fs.existsSync(deploymentsFile) ? JSON.parse(fs.readFileSync(deploymentsFile, "utf8")) : { contracts: {} };

const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545");

function loadAbi(contractName) {
  const abiPath = path.join(abiDir, `${contractName}.json`);
  if (!fs.existsSync(abiPath)) {
    throw new Error(`ABI for ${contractName} not found at ${abiPath}. Did you run the deploy script?`);
  }
  return JSON.parse(fs.readFileSync(abiPath, "utf8")).abi;
}

function getContract(contractName, signerOrProvider = provider) {
  const address = deployment.contracts[contractName];
  if (!address) {
    throw new Error(`No deployed address found for ${contractName} in ${deploymentsFile}`);
  }
  const abi = loadAbi(contractName);
  return new ethers.Contract(address, abi, signerOrProvider);
}

// Wallets the backend uses to sign transactions on behalf of demo issuer orgs / admin.
// In production each issuer organization would hold and use its own private key client-side.
//
// For a local / containerised Hardhat chain the keys are deterministic (the standard
// Hardhat mnemonic), so DERIVE_LOCAL_KEYS=true lets the stack run with no key config.
// A real network (Amoy, mainnet) must set the *_PRIVATE_KEY env vars explicitly.
const HARDHAT_MNEMONIC =
  "test test test test test test test test test test test junk";
const LOCAL_KEY_ACCOUNT = {
  ADMIN_PRIVATE_KEY: 0,
  IDENTITY_AUTHORITY_PRIVATE_KEY: 1,
  EDUCATION_AUTHORITY_PRIVATE_KEY: 2,
  TRANSPORT_AUTHORITY_PRIVATE_KEY: 3
};

function deriveLocalKey(envVarName) {
  const index = LOCAL_KEY_ACCOUNT[envVarName];
  if (index === undefined) return null;
  return ethers.HDNodeWallet.fromPhrase(
    HARDHAT_MNEMONIC,
    undefined,
    `m/44'/60'/0'/0/${index}`
  ).privateKey;
}

function getSigner(envVarName) {
  let key = process.env[envVarName];
  if (!key && process.env.DERIVE_LOCAL_KEYS === "true") {
    key = deriveLocalKey(envVarName);
  }
  if (!key) {
    throw new Error(
      `Missing private key env var: ${envVarName} (set it, or DERIVE_LOCAL_KEYS=true for a local Hardhat chain)`
    );
  }
  return new ethers.Wallet(key, provider);
}

module.exports = { provider, deployment, getContract, getSigner };
