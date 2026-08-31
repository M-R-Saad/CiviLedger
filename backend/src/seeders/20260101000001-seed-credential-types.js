"use strict";
const { v4: uuidv4 } = require("uuid");

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert("credential_types", [
      {
        id: uuidv4(),
        code: "IDENTITY",
        display_name: "National Identity Credential",
        schema_version: 1,
        json_schema: JSON.stringify({
          fields: { full_name: "string", date_of_birth: "date", nid_reference: "string", nationality: "string" }
        }),
        minimal_disclosure_fields: JSON.stringify({ is_above_18: "derived from date_of_birth" }),
        created_at: new Date()
      },
      {
        id: uuidv4(),
        code: "ACADEMIC_DEGREE",
        display_name: "Academic Degree Credential",
        schema_version: 1,
        json_schema: JSON.stringify({
          fields: { institution: "string", degree: "string", graduation_year: "number", gpa: "number" }
        }),
        minimal_disclosure_fields: null,
        created_at: new Date()
      },
      {
        id: uuidv4(),
        code: "DRIVING_LICENSE",
        display_name: "Driving License Credential",
        schema_version: 1,
        json_schema: JSON.stringify({
          fields: { license_number: "string", license_class: "string", issue_date: "date", valid_until: "date" }
        }),
        minimal_disclosure_fields: null,
        created_at: new Date()
      }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("credential_types", null, {});
  }
};
