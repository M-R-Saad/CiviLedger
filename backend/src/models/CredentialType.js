const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const CredentialType = sequelize.define(
  "CredentialType",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    display_name: { type: DataTypes.STRING, allowNull: false },
    schema_version: { type: DataTypes.INTEGER, defaultValue: 1 },
    json_schema: { type: DataTypes.JSONB, allowNull: false },
    minimal_disclosure_fields: { type: DataTypes.JSONB, allowNull: true }
  },
  { tableName: "credential_types", underscored: true }
);

module.exports = CredentialType;
