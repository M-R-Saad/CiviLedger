const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const PurposeSpecificCredential = sequelize.define(
  "PurposeSpecificCredential",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    source_credential_id: { type: DataTypes.UUID, allowNull: false },
    claim_key: { type: DataTypes.STRING(100), allowNull: false },
    claim_value: { type: DataTypes.JSONB, allowNull: false },
    payload_hash: { type: DataTypes.STRING(66), allowNull: false },
    onchain_anchor_id: { type: DataTypes.STRING(66), allowNull: true }
  },
  { tableName: "purpose_specific_credentials", underscored: true }
);

module.exports = PurposeSpecificCredential;
