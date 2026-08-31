const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CredentialStatus", function () {
  let governance, issuerRegistry, credentialRegistry, credentialStatus, admin, issuerOrg, citizen;

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

    const CredentialStatus = await ethers.getContractFactory("CredentialStatus");
    credentialStatus = await CredentialStatus.deploy(credentialRegistry.target);
    await credentialStatus.waitForDeployment();

    const ISSUER_ROLE = await governance.ISSUER_ROLE();
    await governance.connect(admin).proposeMember(issuerOrg.address, "Education Authority", ISSUER_ROLE);
    await governance.connect(admin).approveMember(issuerOrg.address);
    await issuerRegistry.connect(admin).registerIssuer(issuerOrg.address, "Education Authority", ["ACADEMIC_DEGREE"]);
  });

  async function anchorSampleCredential() {
    const payloadHash = ethers.keccak256(ethers.toUtf8Bytes("degree-payload"));
    const tx = await credentialRegistry.connect(issuerOrg).issueAnchor(payloadHash, citizen.address, "ACADEMIC_DEGREE", 0);
    const receipt = await tx.wait();
    const event = receipt.logs
      .map((log) => { try { return credentialRegistry.interface.parseLog(log); } catch { return null; } })
      .find((parsed) => parsed && parsed.name === "CredentialAnchored");
    return event.args.anchorId;
  }

  it("defaults an anchored credential to ACTIVE status", async function () {
    const anchorId = await anchorSampleCredential();
    expect(await credentialStatus.getStatus(anchorId)).to.equal(0); // ACTIVE
  });

  it("lets the issuer revoke a credential, and blocks re-revoking", async function () {
    const anchorId = await anchorSampleCredential();
    await credentialStatus.connect(issuerOrg).revoke(anchorId, "Document found to be fraudulent");
    expect(await credentialStatus.getStatus(anchorId)).to.equal(2); // REVOKED

    await expect(
      credentialStatus.connect(issuerOrg).revoke(anchorId, "again")
    ).to.be.revertedWith("CredentialStatus: already revoked");
  });

  it("rejects a status change from a non-issuer caller", async function () {
    const anchorId = await anchorSampleCredential();
    await expect(
      credentialStatus.connect(citizen).revoke(anchorId, "not allowed")
    ).to.be.revertedWith("CredentialStatus: caller is not the issuer");
  });
});
