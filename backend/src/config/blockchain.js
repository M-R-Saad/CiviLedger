const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const deploymentsFile = path.resolve(__dirname, process.env.DEPLOYMENTS_FILE || "../../../contracts/deployments/localhost.json");

if (!fs.existsSync(deploymentsFile)) {
  console.warn(
    `[blockchain.js] No deployments file found at ${deploymentsFile}. Run "npx hardhat run scripts/deploy.js --network localhost" in contracts/ first.`
  );
}

const deployment = fs.existsSync(deploymentsFile) ? JSON.parse(fs.readFileSync(deploymentsFile, "utf8")) : { contracts: {} };

const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545");

function loadAbi(contractName) {
  const abiPath = path.resolve(__dirname, "..", "contracts-abi", `${contractName}.json`);
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
function getSigner(envVarName) {
  const key = process.env[envVarName];
  if (!key) {
    throw new Error(`Missing private key env var: ${envVarName}`);
  }
  return new ethers.Wallet(key, provider);
}

module.exports = { provider, deployment, getContract, getSigner };
