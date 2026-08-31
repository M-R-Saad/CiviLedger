const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Document = sequelize.define(
  "Document",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    credential_id: { type: DataTypes.UUID, allowNull: true },
    uploaded_by_user_id: { type: DataTypes.UUID, allowNull: false },
    file_path: { type: DataTypes.STRING(500), allowNull: false },
    file_type: { type: DataTypes.STRING(50), allowNull: true }
  },
  { tableName: "documents", underscored: true, updatedAt: false }
);

module.exports = Document;
