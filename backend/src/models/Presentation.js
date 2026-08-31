const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Presentation = sequelize.define(
  "Presentation",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    citizen_user_id: { type: DataTypes.UUID, allowNull: false },
    verifier_org_id: { type: DataTypes.UUID, allowNull: true },
    credential_ids: { type: DataTypes.ARRAY(DataTypes.UUID), allowNull: false },
    consent_signature: { type: DataTypes.TEXT, allowNull: false },
    consent_hash: { type: DataTypes.STRING(66), allowNull: false },
    share_token: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    expires_at: { type: DataTypes.DATE, allowNull: false }
  },
  { tableName: "presentations", underscored: true }
);

module.exports = Presentation;
