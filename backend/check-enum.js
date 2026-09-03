const { sequelize } = require("./src/models");
sequelize.query("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'enum_governance_events_event_type'")
  .then(res => { console.log(res[0]); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
