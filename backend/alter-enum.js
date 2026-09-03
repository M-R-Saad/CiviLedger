const { sequelize } = require("./src/models");
sequelize.query("ALTER TYPE enum_governance_events_event_type ADD VALUE 'CREDENTIAL_ISSUED'")
  .then(() => { console.log("Done"); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
