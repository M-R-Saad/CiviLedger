-- CreateTable
CREATE TABLE "enrolment_invites" (
    "id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "redeemed_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrolment_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enrolment_invites_token_hash_key" ON "enrolment_invites"("token_hash");

-- CreateIndex
CREATE INDEX "enrolment_invites_subject_id_idx" ON "enrolment_invites"("subject_id");

-- CreateIndex
CREATE INDEX "enrolment_invites_expires_at_idx" ON "enrolment_invites"("expires_at");

-- AddForeignKey
ALTER TABLE "enrolment_invites" ADD CONSTRAINT "enrolment_invites_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
