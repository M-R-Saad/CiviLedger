const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // 1. Governance — deployer becomes initial ADMIN
  const Governance = await hre.ethers.getContractFactory("Governance");
  const governance = await Governance.deploy(deployer.address);
  await governance.waitForDeployment();
  console.log("Governance deployed to:", governance.target);

  // 2. IssuerRegistry — depends on Governance
  const IssuerRegistry = await hre.ethers.getContractFactory("IssuerRegistry");
  const issuerRegistry = await IssuerRegistry.deploy(governance.target);
  await issuerRegistry.waitForDeployment();
  console.log("IssuerRegistry deployed to:", issuerRegistry.target);

  // 3. CredentialRegistry — depends on IssuerRegistry
  const CredentialRegistry = await hre.ethers.getContractFactory("CredentialRegistry");
  const credentialRegistry = await CredentialRegistry.deploy(issuerRegistry.target);
  await credentialRegistry.waitForDeployment();
  console.log("CredentialRegistry deployed to:", credentialRegistry.target);

  // 4. CredentialStatus — depends on CredentialRegistry
  const CredentialStatus = await hre.ethers.getContractFactory("CredentialStatus");
  const credentialStatus = await CredentialStatus.deploy(credentialRegistry.target);
  await credentialStatus.waitForDeployment();
  console.log("CredentialStatus deployed to:", credentialStatus.target);

  // 5. ConsentAudit — standalone
  const ConsentAudit = await hre.ethers.getContractFactory("ConsentAudit");
  const consentAudit = await ConsentAudit.deploy();
  await consentAudit.waitForDeployment();
  console.log("ConsentAudit deployed to:", consentAudit.target);

  // Write addresses to deployments/<network>.json
  const network = hre.network.name;
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir);

  const output = {
    network,
    deployer: deployer.address,
    contracts: {
      Governance: governance.target,
      IssuerRegistry: issuerRegistry.target,
      CredentialRegistry: credentialRegistry.target,
      CredentialStatus: credentialStatus.target,
      ConsentAudit: consentAudit.target
    },
    deployedAt: new Date().toISOString()
  };

  fs.writeFileSync(path.join(deploymentsDir, `${network}.json`), JSON.stringify(output, null, 2));
  console.log(`\nAddresses written to deployments/${network}.json`);

  // Copy ABIs into backend/src/contracts-abi so the backend can call these contracts
  const artifactsDir = path.join(__dirname, "..", "artifacts", "contracts");
  const backendAbiDir = path.join(__dirname, "..", "..", "backend", "src", "contracts-abi");
  if (!fs.existsSync(backendAbiDir)) fs.mkdirSync(backendAbiDir, { recursive: true });

  const contractNames = ["Governance", "IssuerRegistry", "CredentialRegistry", "CredentialStatus", "ConsentAudit"];
  for (const name of contractNames) {
    const artifactPath = path.join(artifactsDir, `${name}.sol`, `${name}.json`);
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      fs.writeFileSync(
        path.join(backendAbiDir, `${name}.json`),
        JSON.stringify({ abi: artifact.abi }, null, 2)
      );
    }
  }
  console.log("ABIs synced to backend/src/contracts-abi/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
