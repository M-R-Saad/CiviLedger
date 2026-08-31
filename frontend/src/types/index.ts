// Shared TypeScript types mirroring docs/02_database_schema.json

export type UserRole = "CITIZEN" | "ISSUER_ADMIN" | "VERIFIER_STAFF" | "OVERSIGHT";

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  organization_id?: string;
  wallet_address?: string;
  did?: string;
}

export interface Organization {
  id: string;
  name: string;
  type: "ISSUER" | "VERIFIER" | "BOTH";
  onchain_address?: string;
  credential_types_authorized?: string[];
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "OFFBOARDED";
}

export interface CredentialType {
  id: string;
  code: string;
  display_name: string;
  schema_version: number;
  json_schema: { fields: Record<string, string> };
  minimal_disclosure_fields?: Record<string, string> | null;
}

export type CredentialStatus = "ACTIVE" | "SUSPENDED" | "REVOKED" | "SUPERSEDED";

export interface Credential {
  id: string;
  credential_type_id: string;
  issuer_org_id: string;
  citizen_user_id: string;
  payload: Record<string, unknown>;
  payload_hash: string;
  onchain_anchor_id?: string;
  issued_at: string;
  expires_at?: string;
  status_cache: CredentialStatus;
  CredentialType?: CredentialType;
  issuer?: Organization;
}

export interface Presentation {
  id: string;
  citizen_user_id: string;
  verifier_org_id?: string;
  credential_ids: string[];
  share_token: string;
  expires_at: string;
}

export interface VerificationResult {
  result: "VALID" | "INVALID_SIGNATURE" | "REVOKED" | "EXPIRED" | "ISSUER_NOT_TRUSTED";
  details: Array<{ credential_id: string; liveStatus: string }>;
}
