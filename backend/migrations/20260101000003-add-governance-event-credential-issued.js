"use strict";

// The GovernanceEvent model and issuer.controller gained a "CREDENTIAL_ISSUED"
// event_type, but the Postgres enum type created by the initial migration was
// never altered. Inserting that value fails with:
//   invalid input value for enum enum_governance_events_event_type: "CREDENTIAL_ISSUED"
// Postgres 12+ allows ADD VALUE inside a transaction (the value is usable after
// commit, which is fine here since this migration does not insert it).

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_governance_events_event_type" ADD VALUE IF NOT EXISTS 'CREDENTIAL_ISSUED';`
    );
  },

  async down() {
    // Postgres cannot remove a value from an enum type. No-op.
  }
};
