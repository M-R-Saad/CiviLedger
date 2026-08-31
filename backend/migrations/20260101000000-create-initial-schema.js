"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("organizations", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.ENUM("ISSUER", "VERIFIER", "BOTH"), allowNull: false },
      onchain_address: { type: Sequelize.STRING(42), unique: true },
      credential_types_authorized: { type: Sequelize.ARRAY(Sequelize.STRING) },
      status: { type: Sequelize.ENUM("PENDING", "ACTIVE", "SUSPENDED", "OFFBOARDED"), defaultValue: "PENDING" },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    await queryInterface.createTable("users", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      full_name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING },
      role: { type: Sequelize.ENUM("CITIZEN", "ISSUER_ADMIN", "VERIFIER_STAFF", "OVERSIGHT"), allowNull: false },
      organization_id: { type: Sequelize.UUID, references: { model: "organizations", key: "id" }, onDelete: "SET NULL" },
      wallet_address: { type: Sequelize.STRING(42), unique: true },
      did: { type: Sequelize.STRING, unique: true },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    await queryInterface.createTable("credential_types", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      display_name: { type: Sequelize.STRING, allowNull: false },
      schema_version: { type: Sequelize.INTEGER, defaultValue: 1 },
      json_schema: { type: Sequelize.JSONB, allowNull: false },
      minimal_disclosure_fields: { type: Sequelize.JSONB },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    await queryInterface.createTable("credentials", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      credential_type_id: { type: Sequelize.UUID, allowNull: false, references: { model: "credential_types", key: "id" } },
      issuer_org_id: { type: Sequelize.UUID, allowNull: false, references: { model: "organizations", key: "id" } },
      citizen_user_id: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" } },
      payload: { type: Sequelize.JSONB, allowNull: false },
      payload_hash: { type: Sequelize.STRING(66), allowNull: false },
      onchain_anchor_id: { type: Sequelize.STRING(66) },
      issued_at: { type: Sequelize.DATE, allowNull: false },
      expires_at: { type: Sequelize.DATE },
      status_cache: { type: Sequelize.ENUM("ACTIVE", "SUSPENDED", "REVOKED", "SUPERSEDED"), defaultValue: "ACTIVE" },
      superseded_by_credential_id: { type: Sequelize.UUID },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    await queryInterface.createTable("purpose_specific_credentials", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      source_credential_id: { type: Sequelize.UUID, allowNull: false, references: { model: "credentials", key: "id" } },
      claim_key: { type: Sequelize.STRING(100), allowNull: false },
      claim_value: { type: Sequelize.JSONB, allowNull: false },
      payload_hash: { type: Sequelize.STRING(66), allowNull: false },
      onchain_anchor_id: { type: Sequelize.STRING(66) },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    await queryInterface.createTable("presentations", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      citizen_user_id: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" } },
      verifier_org_id: { type: Sequelize.UUID, references: { model: "organizations", key: "id" } },
      credential_ids: { type: Sequelize.ARRAY(Sequelize.UUID), allowNull: false },
      consent_signature: { type: Sequelize.TEXT, allowNull: false },
      consent_hash: { type: Sequelize.STRING(66), allowNull: false },
      share_token: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    await queryInterface.createTable("verification_events", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      presentation_id: { type: Sequelize.UUID, allowNull: false, references: { model: "presentations", key: "id" } },
      verifier_org_id: { type: Sequelize.UUID, allowNull: false, references: { model: "organizations", key: "id" } },
      verifier_user_id: { type: Sequelize.UUID, references: { model: "users", key: "id" } },
      result: { type: Sequelize.ENUM("VALID", "INVALID_SIGNATURE", "REVOKED", "EXPIRED", "ISSUER_NOT_TRUSTED"), allowNull: false },
      onchain_receipt_tx: { type: Sequelize.STRING(66) },
      verified_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    await queryInterface.createTable("governance_events", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      event_type: {
        type: Sequelize.ENUM(
          "MEMBER_PROPOSED",
          "MEMBER_APPROVED",
          "MEMBER_SUSPENDED",
          "MEMBER_OFFBOARDED",
          "ROLE_GRANTED",
          "ROLE_REVOKED",
          "POLICY_UPDATED"
        ),
        allowNull: false
      },
      organization_id: { type: Sequelize.UUID, references: { model: "organizations", key: "id" } },
      actor_user_id: { type: Sequelize.UUID, references: { model: "users", key: "id" } },
      details: { type: Sequelize.JSONB },
      onchain_tx_hash: { type: Sequelize.STRING(66) },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    await queryInterface.createTable("credential_status_events", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      credential_id: { type: Sequelize.UUID, allowNull: false, references: { model: "credentials", key: "id" } },
      previous_status: { type: Sequelize.ENUM("ACTIVE", "SUSPENDED", "REVOKED", "SUPERSEDED"), allowNull: false },
      new_status: { type: Sequelize.ENUM("ACTIVE", "SUSPENDED", "REVOKED", "SUPERSEDED"), allowNull: false },
      reason: { type: Sequelize.TEXT },
      actor_user_id: { type: Sequelize.UUID, references: { model: "users", key: "id" } },
      onchain_tx_hash: { type: Sequelize.STRING(66) },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    await queryInterface.createTable("documents", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      credential_id: { type: Sequelize.UUID, references: { model: "credentials", key: "id" } },
      uploaded_by_user_id: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" } },
      file_path: { type: Sequelize.STRING(500), allowNull: false },
      file_type: { type: Sequelize.STRING(50) },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("documents");
    await queryInterface.dropTable("credential_status_events");
    await queryInterface.dropTable("governance_events");
    await queryInterface.dropTable("verification_events");
    await queryInterface.dropTable("presentations");
    await queryInterface.dropTable("purpose_specific_credentials");
    await queryInterface.dropTable("credentials");
    await queryInterface.dropTable("credential_types");
    await queryInterface.dropTable("users");
    await queryInterface.dropTable("organizations");
  }
};
