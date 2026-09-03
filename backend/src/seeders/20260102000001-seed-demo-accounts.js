"use strict";
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");

/**
 * Phase 4 — Demo Hardening Seeder
 *
 * Creates a complete set of demo accounts so the app is immediately demoable
 * after `npm run seed`. All passwords are "password123".
 *
 * The Hardhat local node uses deterministic accounts. Accounts 1-3 are used
 * by the 3 issuer orgs (registered on-chain via seed-demo-data.js).
 * Account 4 is the oversight user. Accounts 5-7 are citizens.
 *
 * Hardhat deterministic addresses (from `npx hardhat node` output):
 * Account  0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266  (Admin/deployer)
 * Account  1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8  (Identity Authority)
 * Account  2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC  (Education Authority)
 * Account  3: 0x90F79bf6EB2c4f870365E785982E1f101E93b906  (Transport Authority)
 * Account  4: 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65  (Oversight)
 * Account  5: 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc  (Citizen #1)
 * Account  6: 0x976EA74026E726554dB657fA54763abd0C3a0aa9  (Citizen #2)
 * Account  7: 0x14dC79964da2C08b23698B3D3cc7Ca32193d9955  (Citizen #3)
 * Account  8: 0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f  (Verifier staff)
 */

module.exports = {
  async up(queryInterface) {
    const passwordHash = await bcrypt.hash("password123", 10);
    const now = new Date();

    // ── 1. Organizations ────────────────────────────────────────────────
    const orgIdentity   = uuidv4();
    const orgEducation  = uuidv4();
    const orgTransport  = uuidv4();
    const orgVerifier   = uuidv4();

    await queryInterface.bulkInsert("organizations", [
      {
        id: orgIdentity,
        name: "National Identity Authority",
        type: "ISSUER",
        onchain_address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        credential_types_authorized: "{IDENTITY}",
        status: "ACTIVE",
        created_at: now
      },
      {
        id: orgEducation,
        name: "Education Authority",
        type: "ISSUER",
        onchain_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        credential_types_authorized: "{ACADEMIC_DEGREE}",
        status: "ACTIVE",
        created_at: now
      },
      {
        id: orgTransport,
        name: "Transport Authority (BRTA)",
        type: "ISSUER",
        onchain_address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        credential_types_authorized: "{DRIVING_LICENSE}",
        status: "ACTIVE",
        created_at: now
      },
      {
        id: orgVerifier,
        name: "Employer Corp",
        type: "VERIFIER",
        onchain_address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
        credential_types_authorized: null,
        status: "ACTIVE",
        created_at: now
      }
    ]);

    // ── 2. Users ────────────────────────────────────────────────────────
    const userAdmin       = uuidv4();
    const userIdentity    = uuidv4();
    const userEducation   = uuidv4();
    const userTransport   = uuidv4();
    const userOversight   = uuidv4();
    const userCitizen1    = uuidv4();
    const userCitizen2    = uuidv4();
    const userCitizen3    = uuidv4();
    const userVerifier    = uuidv4();

    await queryInterface.bulkInsert("users", [
      // ── Admin ──
      {
        id: userAdmin,
        full_name: "System Admin",
        email: "admin@civiledger.test",
        password_hash: passwordHash,
        role: "OVERSIGHT",
        organization_id: null,
        wallet_address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        did: "did:ethr:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        created_at: now,
        updated_at: now
      },
      // ── Issuer staff ──
      {
        id: userIdentity,
        full_name: "Rahim Uddin (NID Officer)",
        email: "rahim@identity.gov.test",
        password_hash: passwordHash,
        role: "ISSUER_ADMIN",
        organization_id: orgIdentity,
        wallet_address: null,
        did: null,
        created_at: now,
        updated_at: now
      },
      {
        id: userEducation,
        full_name: "Dr. Nusrat Jahan (Education Officer)",
        email: "nusrat@edu.gov.test",
        password_hash: passwordHash,
        role: "ISSUER_ADMIN",
        organization_id: orgEducation,
        wallet_address: null,
        did: null,
        created_at: now,
        updated_at: now
      },
      {
        id: userTransport,
        full_name: "Kamal Hossain (BRTA Officer)",
        email: "kamal@brta.gov.test",
        password_hash: passwordHash,
        role: "ISSUER_ADMIN",
        organization_id: orgTransport,
        wallet_address: null,
        did: null,
        created_at: now,
        updated_at: now
      },
      // ── Oversight ──
      {
        id: userOversight,
        full_name: "Oversight Auditor",
        email: "auditor@civiledger.test",
        password_hash: passwordHash,
        role: "OVERSIGHT",
        organization_id: null,
        wallet_address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        did: "did:ethr:0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        created_at: now,
        updated_at: now
      },
      // ── Citizens (have passwords for demo login; in production they'd use MetaMask only) ──
      {
        id: userCitizen1,
        full_name: "Ahnaf Tahmid",
        email: "ahnaf@citizen.test",
        password_hash: passwordHash,
        role: "CITIZEN",
        organization_id: null,
        wallet_address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
        did: "did:ethr:0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
        created_at: now,
        updated_at: now
      },
      {
        id: userCitizen2,
        full_name: "Sumaya Zaman",
        email: "sumaya@citizen.test",
        password_hash: passwordHash,
        role: "CITIZEN",
        organization_id: null,
        wallet_address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
        did: "did:ethr:0x976EA74026E726554dB657fA54763abd0C3a0aa9",
        created_at: now,
        updated_at: now
      },
      {
        id: userCitizen3,
        full_name: "Shahriar Morshed",
        email: "shahriar@citizen.test",
        password_hash: passwordHash,
        role: "CITIZEN",
        organization_id: null,
        wallet_address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
        did: "did:ethr:0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
        created_at: now,
        updated_at: now
      },
      // ── Verifier staff ──
      {
        id: userVerifier,
        full_name: "Abrar Jahin (HR Manager)",
        email: "abrar@employer.test",
        password_hash: passwordHash,
        role: "VERIFIER_STAFF",
        organization_id: orgVerifier,
        wallet_address: null,
        did: null,
        created_at: now,
        updated_at: now
      }
    ]);

    // ── 3. Governance Events (mirror what seed-demo-data.js did on-chain) ─────
    await queryInterface.bulkInsert("governance_events", [
      {
        id: uuidv4(),
        event_type: "MEMBER_PROPOSED",
        organization_id: orgIdentity,
        actor_user_id: userAdmin,
        details: JSON.stringify({ name: "National Identity Authority", onchain_address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" }),
        onchain_tx_hash: null,
        created_at: now
      },
      {
        id: uuidv4(),
        event_type: "MEMBER_APPROVED",
        organization_id: orgIdentity,
        actor_user_id: userAdmin,
        details: JSON.stringify({ name: "National Identity Authority" }),
        onchain_tx_hash: null,
        created_at: now
      },
      {
        id: uuidv4(),
        event_type: "MEMBER_PROPOSED",
        organization_id: orgEducation,
        actor_user_id: userAdmin,
        details: JSON.stringify({ name: "Education Authority", onchain_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" }),
        onchain_tx_hash: null,
        created_at: now
      },
      {
        id: uuidv4(),
        event_type: "MEMBER_APPROVED",
        organization_id: orgEducation,
        actor_user_id: userAdmin,
        details: JSON.stringify({ name: "Education Authority" }),
        onchain_tx_hash: null,
        created_at: now
      },
      {
        id: uuidv4(),
        event_type: "MEMBER_PROPOSED",
        organization_id: orgTransport,
        actor_user_id: userAdmin,
        details: JSON.stringify({ name: "Transport Authority (BRTA)", onchain_address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" }),
        onchain_tx_hash: null,
        created_at: now
      },
      {
        id: uuidv4(),
        event_type: "MEMBER_APPROVED",
        organization_id: orgTransport,
        actor_user_id: userAdmin,
        details: JSON.stringify({ name: "Transport Authority (BRTA)" }),
        onchain_tx_hash: null,
        created_at: now
      },
      {
        id: uuidv4(),
        event_type: "MEMBER_PROPOSED",
        organization_id: orgVerifier,
        actor_user_id: userAdmin,
        details: JSON.stringify({ name: "Employer Corp", onchain_address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f" }),
        onchain_tx_hash: null,
        created_at: now
      },
      {
        id: uuidv4(),
        event_type: "MEMBER_APPROVED",
        organization_id: orgVerifier,
        actor_user_id: userAdmin,
        details: JSON.stringify({ name: "Employer Corp" }),
        onchain_tx_hash: null,
        created_at: now
      }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("governance_events", null, {});
    await queryInterface.bulkDelete("users", null, {});
    await queryInterface.bulkDelete("organizations", null, {});
  }
};
