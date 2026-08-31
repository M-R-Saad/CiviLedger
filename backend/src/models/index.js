const sequelize = require("../config/db");
const User = require("./User");
const Organization = require("./Organization");
const CredentialType = require("./CredentialType");
const Credential = require("./Credential");
const PurposeSpecificCredential = require("./PurposeSpecificCredential");
const Presentation = require("./Presentation");
const VerificationEvent = require("./VerificationEvent");
const GovernanceEvent = require("./GovernanceEvent");
const CredentialStatusEvent = require("./CredentialStatusEvent");
const Document = require("./Document");

// --- Associations (mirrors docs/02_database_schema.json relationships_summary) ---
Organization.hasMany(User, { foreignKey: "organization_id" });
User.belongsTo(Organization, { foreignKey: "organization_id" });

CredentialType.hasMany(Credential, { foreignKey: "credential_type_id" });
Credential.belongsTo(CredentialType, { foreignKey: "credential_type_id" });

Organization.hasMany(Credential, { foreignKey: "issuer_org_id", as: "issuedCredentials" });
Credential.belongsTo(Organization, { foreignKey: "issuer_org_id", as: "issuer" });

User.hasMany(Credential, { foreignKey: "citizen_user_id", as: "credentials" });
Credential.belongsTo(User, { foreignKey: "citizen_user_id", as: "citizen" });

Credential.hasMany(PurposeSpecificCredential, { foreignKey: "source_credential_id" });
PurposeSpecificCredential.belongsTo(Credential, { foreignKey: "source_credential_id" });

User.hasMany(Presentation, { foreignKey: "citizen_user_id" });
Presentation.belongsTo(User, { foreignKey: "citizen_user_id", as: "citizen" });
Presentation.belongsTo(Organization, { foreignKey: "verifier_org_id", as: "verifierOrg" });

Presentation.hasMany(VerificationEvent, { foreignKey: "presentation_id" });
VerificationEvent.belongsTo(Presentation, { foreignKey: "presentation_id" });

Credential.hasMany(CredentialStatusEvent, { foreignKey: "credential_id" });
CredentialStatusEvent.belongsTo(Credential, { foreignKey: "credential_id" });

Organization.hasMany(GovernanceEvent, { foreignKey: "organization_id" });
GovernanceEvent.belongsTo(Organization, { foreignKey: "organization_id" });

Credential.hasMany(Document, { foreignKey: "credential_id" });
Document.belongsTo(Credential, { foreignKey: "credential_id" });

module.exports = {
  sequelize,
  User,
  Organization,
  CredentialType,
  Credential,
  PurposeSpecificCredential,
  Presentation,
  VerificationEvent,
  GovernanceEvent,
  CredentialStatusEvent,
  Document
};
