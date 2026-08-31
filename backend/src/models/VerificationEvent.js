const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const VerificationEvent = sequelize.define(
  "VerificationEvent",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    presentation_id: { type: DataTypes.UUID, allowNull: false },
    verifier_org_id: { type: DataTypes.UUID, allowNull: false },
    verifier_user_id: { type: DataTypes.UUID, allowNull: true },
    result: {
      type: DataTypes.ENUM("VALID", "INVALID_SIGNATURE", "REVOKED", "EXPIRED", "ISSUER_NOT_TRUSTED"),
      allowNull: false
    },
    onchain_receipt_tx: { type: DataTypes.STRING(66), allowNull: true },
    verified_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  },
  { tableName: "verification_events", underscored: true, updatedAt: false, createdAt: false }
);

module.exports = VerificationEvent;
