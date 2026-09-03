require("dotenv").config();

// Plain JS config consumed by sequelize-cli (separate from the Sequelize instance in db.js,
// which is what the app itself uses at runtime).
const common = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: "postgres" // PostgreSQL only; the schema uses JSONB / ENUM / arrays
};

module.exports = {
  development: common,
  test: common,
  production: common
};
