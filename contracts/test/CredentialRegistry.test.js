const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CredentialRegistry", function () {
  let governance, issuerRegistry, credentialRegistry, admin, issuerOrg, citizen;

  beforeEach(async function () {
    [admin, issuerOrg, citizen] = await ethers.getSigners();

    const Governance = await ethers.getContractFactory("Governance");
    governance = await Governance.deploy(admin.address);
    await governance.waitForDeployment();

    const IssuerRegistry = await ethers.getContractFactory("IssuerRegistry");
    issuerRegistry = await IssuerRegistry.deploy(governance.target);
    await issuerRegistry.waitForDeployment();

    const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
    credentialRegistry = await CredentialRegistry.deploy(issuerRegistry.target);
    await credentialRegistry.waitForDeployment();

    const ISSUER_ROLE = await governance.ISSUER_ROLE();
    await governance.connect(admin).proposeMember(issuerOrg.address, "Education Authority", ISSUER_ROLE);
    await governance.connect(admin).approveMember(issuerOrg.address);
    await issuerRegistry.connect(admin).registerIssuer(issuerOrg.address, "Education Authority", ["ACADEMIC_DEGREE"]);
  });

  it("lets an active issuer anchor a credential", async function () {
    const payloadHash = ethers.keccak256(ethers.toUtf8Bytes("degree-payload"));
    const tx = await credentialRegistry.connect(issuerOrg).issueAnchor(payloadHash, citizen.address, "ACADEMIC_DEGREE", 0);
    await expect(tx).to.emit(credentialRegistry, "CredentialAnchored");
  });

  it("rejects anchoring from a non-issuer address", async function () {
    const payloadHash = ethers.keccak256(ethers.toUtf8Bytes("degree-payload"));
    await expect(
      credentialRegistry.connect(citizen).issueAnchor(payloadHash, citizen.address, "ACADEMIC_DEGREE", 0)
    ).to.be.revertedWith("CredentialRegistry: caller is not an active issuer");
  });

  it("rejects anchoring a credential type the issuer is not registered for", async function () {
    const payloadHash = ethers.keccak256(ethers.toUtf8Bytes("licence-payload"));
    // issuerOrg is registered for ACADEMIC_DEGREE only.
    await expect(
      credentialRegistry.connect(issuerOrg).issueAnchor(payloadHash, citizen.address, "DRIVING_LICENSE", 0)
    ).to.be.revertedWith("CredentialRegistry: issuer not authorized for this credential type");
  });

  it("exposes isAuthorizedFor per credential type", async function () {
    expect(await issuerRegistry.isAuthorizedFor(issuerOrg.address, "ACADEMIC_DEGREE")).to.equal(true);
    expect(await issuerRegistry.isAuthorizedFor(issuerOrg.address, "DRIVING_LICENSE")).to.equal(false);
    expect(await issuerRegistry.isAuthorizedFor(citizen.address, "ACADEMIC_DEGREE")).to.equal(false);
  });
});
