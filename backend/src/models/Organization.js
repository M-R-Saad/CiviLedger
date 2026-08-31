const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Organization = sequelize.define(
  "Organization",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.ENUM("ISSUER", "VERIFIER", "BOTH"), allowNull: false },
    onchain_address: { type: DataTypes.STRING(42), allowNull: true, unique: true },
    credential_types_authorized: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
    status: {
      type: DataTypes.ENUM("PENDING", "ACTIVE", "SUSPENDED", "OFFBOARDED"),
      defaultValue: "PENDING"
    }
  },
  { tableName: "organizations", underscored: true }
);

module.exports = Organization;
