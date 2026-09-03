const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Registers the 3 demo issuer organizations on-chain so you can start issuing
// credentials right away: Identity Authority, Education Authority, Transport Authority.
async function main() {
  const network = hre.network.name;
  const deploymentsDir = process.env.DEPLOY_OUT_DIR
    ? path.resolve(process.env.DEPLOY_OUT_DIR)
    : path.join(__dirname, "..", "deployments");
  const deploymentPath = path.join(deploymentsDir, `${network}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment found for network "${network}" at ${deploymentPath}. Run deploy.js first.`);
  }
  const { contracts } = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  const [admin, identityAuthority, educationAuthority, transportAuthority, oversightUser] =
    await hre.ethers.getSigners();

  const governance = await hre.ethers.getContractAt("Governance", contracts.Governance, admin);
  const issuerRegistry = await hre.ethers.getContractAt("IssuerRegistry", contracts.IssuerRegistry, admin);

  const ISSUER_ROLE = await governance.ISSUER_ROLE();

  const demoIssuers = [
    { signer: identityAuthority, name: "Identity Authority", types: ["IDENTITY"] },
    { signer: educationAuthority, name: "Education Authority", types: ["ACADEMIC_DEGREE"] },
    { signer: transportAuthority, name: "Transport Authority", types: ["DRIVING_LICENSE"] }
  ];

  for (const issuer of demoIssuers) {
    console.log(`\nProposing + approving: ${issuer.name} (${issuer.signer.address})`);
    let tx = await governance.proposeMember(issuer.signer.address, issuer.name, ISSUER_ROLE);
    await tx.wait();
    tx = await governance.approveMember(issuer.signer.address);
    await tx.wait();

    tx = await issuerRegistry.registerIssuer(issuer.signer.address, issuer.name, issuer.types);
    await tx.wait();
    console.log(`Registered ${issuer.name} as an active issuer.`);
  }

  console.log(`\nGranting OVERSIGHT role to ${oversightUser.address}`);
  const tx = await governance.grantOversight(oversightUser.address);
  await tx.wait();

  console.log("\nDemo seed complete. Suggested .env accounts for local testing:");
  console.log("ADMIN_ADDRESS      =", admin.address);
  console.log("IDENTITY_AUTHORITY =", identityAuthority.address);
  console.log("EDUCATION_AUTHORITY=", educationAuthority.address);
  console.log("TRANSPORT_AUTHORITY=", transportAuthority.address);
  console.log("OVERSIGHT_USER     =", oversightUser.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
