const { Sequelize } = require("sequelize");
require("dotenv").config();

const dialect = process.env.DB_DIALECT || "postgres";

const sequelize =
  dialect === "sqlite"
    ? new Sequelize({
        dialect: "sqlite",
        storage: process.env.DB_STORAGE || "./dev.sqlite",
        logging: false
      })
    : new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: "postgres",
        logging: false
      });

module.exports = sequelize;
