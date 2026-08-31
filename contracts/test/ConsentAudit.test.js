const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ConsentAudit", function () {
  let consentAudit, citizen, verifier;

  beforeEach(async function () {
    [, citizen, verifier] = await ethers.getSigners();
    const ConsentAudit = await ethers.getContractFactory("ConsentAudit");
    consentAudit = await ConsentAudit.deploy();
    await consentAudit.waitForDeployment();
  });

  it("records a consent hash and lists it under the citizen's audit trail", async function () {
    const consentHash = ethers.keccak256(ethers.toUtf8Bytes("share-degree-with-employerX"));
    await consentAudit.connect(citizen).recordConsentHash(consentHash);

    const indexes = await consentAudit.queryCitizenAudit(citizen.address);
    expect(indexes.length).to.equal(1);

    const record = await consentAudit.getConsentRecord(indexes[0]);
    expect(record.citizen).to.equal(citizen.address);
    expect(record.consentHash).to.equal(consentHash);
  });

  it("records a presentation receipt linked to a consent hash", async function () {
    const consentHash = ethers.keccak256(ethers.toUtf8Bytes("share-degree-with-employerX"));
    await consentAudit.connect(citizen).recordConsentHash(consentHash);
    await consentAudit.connect(verifier).recordPresentationReceipt(consentHash, true);

    const receiptIndexes = await consentAudit.getReceiptsForConsent(consentHash);
    expect(receiptIndexes.length).to.equal(1);

    const receipt = await consentAudit.getReceipt(receiptIndexes[0]);
    expect(receipt.verifier).to.equal(verifier.address);
    expect(receipt.result).to.be.true;
  });
});
