const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const GovernanceEvent = sequelize.define(
  "GovernanceEvent",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    event_type: {
      type: DataTypes.ENUM(
        "MEMBER_PROPOSED",
        "MEMBER_APPROVED",
        "MEMBER_SUSPENDED",
        "MEMBER_OFFBOARDED",
        "ROLE_GRANTED",
        "ROLE_REVOKED",
        "POLICY_UPDATED",
        "CREDENTIAL_ISSUED"
      ),
      allowNull: false
    },
    organization_id: { type: DataTypes.UUID, allowNull: true },
    actor_user_id: { type: DataTypes.UUID, allowNull: true },
    details: { type: DataTypes.JSONB, allowNull: true },
    onchain_tx_hash: { type: DataTypes.STRING(66), allowNull: true }
  },
  { tableName: "governance_events", underscored: true, updatedAt: false }
);

module.exports = GovernanceEvent;
