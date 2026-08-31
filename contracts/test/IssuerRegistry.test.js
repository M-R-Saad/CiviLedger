const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IssuerRegistry", function () {
  let governance, issuerRegistry, admin, issuerOrg, other;

  beforeEach(async function () {
    [admin, issuerOrg, other] = await ethers.getSigners();

    const Governance = await ethers.getContractFactory("Governance");
    governance = await Governance.deploy(admin.address);
    await governance.waitForDeployment();

    const IssuerRegistry = await ethers.getContractFactory("IssuerRegistry");
    issuerRegistry = await IssuerRegistry.deploy(governance.target);
    await issuerRegistry.waitForDeployment();

    const ISSUER_ROLE = await governance.ISSUER_ROLE();
    await governance.connect(admin).proposeMember(issuerOrg.address, "Education Authority", ISSUER_ROLE);
    await governance.connect(admin).approveMember(issuerOrg.address);
  });

  it("registers an issuer that already holds ISSUER_ROLE", async function () {
    await issuerRegistry.connect(admin).registerIssuer(issuerOrg.address, "Education Authority", ["ACADEMIC_DEGREE"]);
    const issuer = await issuerRegistry.getIssuer(issuerOrg.address);
    expect(issuer.name).to.equal("Education Authority");
    expect(await issuerRegistry.isActiveIssuer(issuerOrg.address)).to.be.true;
  });

  it("rejects registering an address without ISSUER_ROLE", async function () {
    await expect(
      issuerRegistry.connect(admin).registerIssuer(other.address, "Fake Org", ["ACADEMIC_DEGREE"])
    ).to.be.revertedWith("IssuerRegistry: not ISSUER_ROLE");
  });

  it("rejects registration from a non-admin caller", async function () {
    await expect(
      issuerRegistry.connect(other).registerIssuer(issuerOrg.address, "Education Authority", ["ACADEMIC_DEGREE"])
    ).to.be.reverted;
  });
});
