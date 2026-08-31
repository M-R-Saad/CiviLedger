"use strict";

// Several tables were created with only created_at but Sequelize models
// (with underscored: true) expect both created_at and updated_at by default.
// This migration adds the missing updated_at columns.
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = [
      "organizations",
      "credentials",
      "credential_types",
      "presentations",
      "purpose_specific_credentials"
    ];

    for (const table of tables) {
      await queryInterface.addColumn(table, "updated_at", {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      });
    }
  },

  async down(queryInterface) {
    const tables = [
      "organizations",
      "credentials",
      "credential_types",
      "presentations",
      "purpose_specific_credentials"
    ];

    for (const table of tables) {
      await queryInterface.removeColumn(table, "updated_at");
    }
  }
};
