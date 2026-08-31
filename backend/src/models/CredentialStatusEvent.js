const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const CredentialStatusEvent = sequelize.define(
  "CredentialStatusEvent",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    credential_id: { type: DataTypes.UUID, allowNull: false },
    previous_status: {
      type: DataTypes.ENUM("ACTIVE", "SUSPENDED", "REVOKED", "SUPERSEDED"),
      allowNull: false
    },
    new_status: {
      type: DataTypes.ENUM("ACTIVE", "SUSPENDED", "REVOKED", "SUPERSEDED"),
      allowNull: false
    },
    reason: { type: DataTypes.TEXT, allowNull: true },
    actor_user_id: { type: DataTypes.UUID, allowNull: true },
    onchain_tx_hash: { type: DataTypes.STRING(66), allowNull: true }
  },
  { tableName: "credential_status_events", underscored: true, updatedAt: false }
);

module.exports = CredentialStatusEvent;
