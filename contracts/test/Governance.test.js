const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Governance", function () {
  let governance, admin, issuerOrg, other;

  beforeEach(async function () {
    [admin, issuerOrg, other] = await ethers.getSigners();
    const Governance = await ethers.getContractFactory("Governance");
    governance = await Governance.deploy(admin.address);
    await governance.waitForDeployment();
  });

  it("grants ADMIN_ROLE to the deployer", async function () {
    const ADMIN_ROLE = await governance.ADMIN_ROLE();
    expect(await governance.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
  });

  it("lets an admin propose and approve a member, granting ISSUER_ROLE", async function () {
    const ISSUER_ROLE = await governance.ISSUER_ROLE();

    await governance.connect(admin).proposeMember(issuerOrg.address, "Education Authority", ISSUER_ROLE);
    let member = await governance.getMember(issuerOrg.address);
    expect(member.status).to.equal(1); // PROPOSED

    await governance.connect(admin).approveMember(issuerOrg.address);
    member = await governance.getMember(issuerOrg.address);
    expect(member.status).to.equal(2); // APPROVED
    expect(await governance.hasRole(ISSUER_ROLE, issuerOrg.address)).to.be.true;
  });

  it("prevents a non-admin from proposing a member", async function () {
    const ISSUER_ROLE = await governance.ISSUER_ROLE();
    await expect(
      governance.connect(other).proposeMember(issuerOrg.address, "Fake Org", ISSUER_ROLE)
    ).to.be.reverted;
  });

  it("can suspend an approved member, revoking their role", async function () {
    const ISSUER_ROLE = await governance.ISSUER_ROLE();
    await governance.connect(admin).proposeMember(issuerOrg.address, "Education Authority", ISSUER_ROLE);
    await governance.connect(admin).approveMember(issuerOrg.address);

    await governance.connect(admin).suspendMember(issuerOrg.address);
    expect(await governance.hasRole(ISSUER_ROLE, issuerOrg.address)).to.be.false;
  });
});
