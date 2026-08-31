const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Credential = sequelize.define(
  "Credential",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    credential_type_id: { type: DataTypes.UUID, allowNull: false },
    issuer_org_id: { type: DataTypes.UUID, allowNull: false },
    citizen_user_id: { type: DataTypes.UUID, allowNull: false },
    payload: { type: DataTypes.JSONB, allowNull: false },
    payload_hash: { type: DataTypes.STRING(66), allowNull: false },
    onchain_anchor_id: { type: DataTypes.STRING(66), allowNull: true },
    issued_at: { type: DataTypes.DATE, allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: true },
    status_cache: {
      type: DataTypes.ENUM("ACTIVE", "SUSPENDED", "REVOKED", "SUPERSEDED"),
      defaultValue: "ACTIVE"
    },
    superseded_by_credential_id: { type: DataTypes.UUID, allowNull: true }
  },
  { tableName: "credentials", underscored: true }
);

module.exports = Credential;
