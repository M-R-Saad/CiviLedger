-- CreateEnum
CREATE TYPE "Accreditation" AS ENUM ('SELF_ASSERTED', 'PROFESSIONAL_BODY', 'BOARD', 'UGC_RECOGNIZED');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'RETIRED');

-- CreateEnum
CREATE TYPE "AssuranceLevel" AS ENUM ('AL0', 'AL1', 'AL2', 'AL3', 'AL3_PLUS');

-- CreateEnum
CREATE TYPE "CredentialState" AS ENUM ('DRAFT', 'ISSUED', 'REVOKED', 'SUSPENDED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "BatchState" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SIGNING', 'ANCHORING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportState" AS ENUM ('UPLOADED', 'NORMALISING', 'REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ImportRowState" AS ENUM ('PENDING', 'READY', 'CONFLICT', 'REJECTED', 'ISSUED');

-- CreateEnum
CREATE TYPE "StatusPurpose" AS ENUM ('REVOCATION', 'SUSPENSION');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('REGISTRAR', 'EXAM_CONTROLLER', 'ORG_ADMIN', 'VERIFIER_STAFF', 'OVERSIGHT', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "VerifierPlan" AS ENUM ('FREE', 'METERED', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "KybStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VerificationOutcome" AS ENUM ('VALID', 'INVALID', 'REVOKED', 'SUSPENDED', 'EXPIRED', 'UNKNOWN_ISSUER', 'UNDETERMINED');

-- CreateEnum
CREATE TYPE "OutboxState" AS ENUM ('PENDING', 'IN_FLIGHT', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "org_id_hash" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "name_bn" TEXT,
    "issuer_url" TEXT NOT NULL,
    "did_web" TEXT NOT NULL,
    "accreditation" "Accreditation" NOT NULL DEFAULT 'SELF_ASSERTED',
    "ugc_reg_no" TEXT,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'PENDING',
    "revenue_share_bps" INTEGER NOT NULL DEFAULT 3000,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issuer_keys" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "epoch" INTEGER NOT NULL,
    "jwk_thumbprint" TEXT NOT NULL,
    "public_jwk" JSONB NOT NULL,
    "kms_key_ref" TEXT NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issuer_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" UUID NOT NULL,
    "display_name_enc" BYTEA NOT NULL,
    "dob_enc" BYTEA,
    "national_id_enc" BYTEA,
    "email_enc" BYTEA,
    "phone_enc" BYTEA,
    "email_index" TEXT,
    "identity_assurance" "AssuranceLevel" NOT NULL DEFAULT 'AL0',
    "holder_key_jwk" JSONB,
    "password_hash" TEXT,
    "erased_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "vct" TEXT NOT NULL,
    "sd_jwt_enc" BYTEA NOT NULL,
    "salt_enc" BYTEA NOT NULL,
    "sd_jwt_digest" TEXT NOT NULL,
    "status_list_id" UUID,
    "status_index" INTEGER,
    "assurance_level" "AssuranceLevel" NOT NULL,
    "evidence_json" JSONB NOT NULL,
    "state" "CredentialState" NOT NULL DEFAULT 'DRAFT',
    "issued_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "batch_id" UUID,
    "superseded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_status_events" (
    "id" UUID NOT NULL,
    "credential_id" UUID NOT NULL,
    "previous_state" "CredentialState" NOT NULL,
    "new_state" "CredentialState" NOT NULL,
    "reason_code" TEXT NOT NULL,
    "actor_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credential_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "merkle_root" TEXT,
    "leaf_count" INTEGER NOT NULL DEFAULT 0,
    "manifest_uri" TEXT,
    "on_chain_batch_id" TEXT,
    "tx_hash" TEXT,
    "anchored_at" TIMESTAMP(3),
    "state" "BatchState" NOT NULL DEFAULT 'DRAFT',
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "prepared_by_id" UUID,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_lists" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "list_id" INTEGER NOT NULL,
    "purpose" "StatusPurpose" NOT NULL DEFAULT 'REVOCATION',
    "size" INTEGER NOT NULL DEFAULT 131072,
    "bitstring" BYTEA NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "list_hash" TEXT,
    "published_uri" TEXT,
    "signed_jwt" TEXT,
    "allocated_count" INTEGER NOT NULL DEFAULT 0,
    "sealed" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_imports" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "vct" TEXT NOT NULL,
    "state" "ImportState" NOT NULL DEFAULT 'UPLOADED',
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "ready_count" INTEGER NOT NULL DEFAULT 0,
    "conflict_count" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by_id" UUID NOT NULL,
    "assurance_level" "AssuranceLevel" NOT NULL,
    "evidence_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credential_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "raw_enc" BYTEA NOT NULL,
    "normalised_enc" BYTEA,
    "issues_json" JSONB NOT NULL DEFAULT '[]',
    "state" "ImportRowState" NOT NULL DEFAULT 'PENDING',
    "subject_id" UUID,
    "credential_id" UUID,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_links" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "credential_id" UUID NOT NULL,
    "claim_scope" TEXT[],
    "purpose" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifiers" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "org_name" TEXT NOT NULL,
    "contact_email_enc" BYTEA NOT NULL,
    "plan" "VerifierPlan" NOT NULL DEFAULT 'FREE',
    "api_key_hash" TEXT,
    "api_key_prefix" TEXT,
    "monthly_quota" INTEGER NOT NULL DEFAULT 50,
    "kyb_status" "KybStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" UUID NOT NULL,
    "credential_id" UUID,
    "verifier_id" UUID,
    "share_link_id" UUID,
    "claim_scope" TEXT[],
    "result" "VerificationOutcome" NOT NULL,
    "failure_code" TEXT,
    "basis" TEXT NOT NULL DEFAULT 'live',
    "report_enc" BYTEA,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_receipts" (
    "id" UUID NOT NULL,
    "verification_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "receipt_digest" TEXT NOT NULL,
    "receipt_enc" BYTEA NOT NULL,
    "anchored_in" BIGINT,
    "merkle_proof" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email_index" TEXT NOT NULL,
    "email_enc" BYTEA NOT NULL,
    "display_name_enc" BYTEA NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "organization_id" UUID,
    "verifier_id" UUID,
    "disabled_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "actor_type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "payload_digest" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_entries" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "state" "OutboxState" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "leased_until" TIMESTAMP(3),
    "tx_hash" TEXT,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_org_id_hash_key" ON "organizations"("org_id_hash");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_issuer_url_key" ON "organizations"("issuer_url");

-- CreateIndex
CREATE INDEX "issuer_keys_jwk_thumbprint_idx" ON "issuer_keys"("jwk_thumbprint");

-- CreateIndex
CREATE UNIQUE INDEX "issuer_keys_organization_id_epoch_key" ON "issuer_keys"("organization_id", "epoch");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_email_index_key" ON "subjects"("email_index");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_superseded_by_id_key" ON "credentials"("superseded_by_id");

-- CreateIndex
CREATE INDEX "credentials_organization_id_issued_at_idx" ON "credentials"("organization_id", "issued_at");

-- CreateIndex
CREATE INDEX "credentials_subject_id_idx" ON "credentials"("subject_id");

-- CreateIndex
CREATE INDEX "credentials_batch_id_idx" ON "credentials"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_status_list_id_status_index_key" ON "credentials"("status_list_id", "status_index");

-- CreateIndex
CREATE INDEX "credential_status_events_credential_id_created_at_idx" ON "credential_status_events"("credential_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "batches_on_chain_batch_id_key" ON "batches"("on_chain_batch_id");

-- CreateIndex
CREATE INDEX "batches_organization_id_created_at_idx" ON "batches"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "status_lists_organization_id_list_id_purpose_key" ON "status_lists"("organization_id", "list_id", "purpose");

-- CreateIndex
CREATE INDEX "credential_imports_organization_id_created_at_idx" ON "credential_imports"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "import_rows_import_id_state_idx" ON "import_rows"("import_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "import_rows_import_id_row_number_key" ON "import_rows"("import_id", "row_number");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_hash_key" ON "share_links"("token_hash");

-- CreateIndex
CREATE INDEX "share_links_credential_id_created_at_idx" ON "share_links"("credential_id", "created_at");

-- CreateIndex
CREATE INDEX "share_links_expires_at_idx" ON "share_links"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "verifiers_organization_id_key" ON "verifiers"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "verifiers_api_key_hash_key" ON "verifiers"("api_key_hash");

-- CreateIndex
CREATE INDEX "verifications_verifier_id_created_at_idx" ON "verifications"("verifier_id", "created_at");

-- CreateIndex
CREATE INDEX "verifications_credential_id_created_at_idx" ON "verifications"("credential_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "consent_receipts_verification_id_key" ON "consent_receipts"("verification_id");

-- CreateIndex
CREATE INDEX "consent_receipts_subject_id_created_at_idx" ON "consent_receipts"("subject_id", "created_at");

-- CreateIndex
CREATE INDEX "consent_receipts_anchored_in_idx" ON "consent_receipts"("anchored_in");

-- CreateIndex
CREATE INDEX "consent_receipts_expires_at_idx" ON "consent_receipts"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_index_key" ON "users"("email_index");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "audit_events_created_at_idx" ON "audit_events"("created_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_user_id_created_at_idx" ON "audit_events"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "outbox_entries_state_available_at_idx" ON "outbox_entries"("state", "available_at");

-- AddForeignKey
ALTER TABLE "issuer_keys" ADD CONSTRAINT "issuer_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_status_list_id_fkey" FOREIGN KEY ("status_list_id") REFERENCES "status_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_status_events" ADD CONSTRAINT "credential_status_events_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_lists" ADD CONSTRAINT "status_lists_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_imports" ADD CONSTRAINT "credential_imports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "credential_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifiers" ADD CONSTRAINT "verifiers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_verifier_id_fkey" FOREIGN KEY ("verifier_id") REFERENCES "verifiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "share_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_receipts" ADD CONSTRAINT "consent_receipts_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_receipts" ADD CONSTRAINT "consent_receipts_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_verifier_id_fkey" FOREIGN KEY ("verifier_id") REFERENCES "verifiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
