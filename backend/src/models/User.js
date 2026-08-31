const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const User = sequelize.define(
  "User",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    full_name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING, allowNull: true },
    role: {
      type: DataTypes.ENUM("CITIZEN", "ISSUER_ADMIN", "VERIFIER_STAFF", "OVERSIGHT"),
      allowNull: false
    },
    organization_id: { type: DataTypes.UUID, allowNull: true },
    wallet_address: { type: DataTypes.STRING(42), allowNull: true, unique: true },
    did: { type: DataTypes.STRING, allowNull: true, unique: true }
  },
  { tableName: "users", underscored: true }
);

module.exports = User;
