const { Sequelize } = require("sequelize");
require("dotenv").config();

// PostgreSQL only. The models and migrations use JSONB, native ENUM, and array
// columns, so SQLite is not a supported target despite older docs.
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 5432,
    dialect: "postgres",
    logging: false
  }
);

module.exports = sequelize;
