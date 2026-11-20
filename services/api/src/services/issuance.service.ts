/**
 * Issuance: import, review, approve, sign, anchor. PLAN.html §5.3, §5.2.
 *
 * The shape of this pipeline is set by two requirements that pull against each
 * other:
 *
 *   - Retroactive attestation is the day-one feature (§5.2). Most records that
 *     need verifying were issued on paper, so the registrar is confirming an
 *     old record rather than minting a new one — and the credential must say
 *     so, in an assurance level and an evidence block a verifier always sees.
 *
 *   - An issuer insider signing a fake degree cannot be prevented
 *     cryptographically, only detected (§17). Hence four-eyes approval: whoever
 *     uploads a batch may not approve it.
 */

import { createHash, randomBytes } from 'node:crypto';
import {
  issueCredential,
  requireCredentialType,
  validateClaims,
  type AlwaysVisibleClaims,
  type AssuranceLevel as CredentialAssuranceLevel,
  type CredentialEvidence,
} from '@civiledger/credential';
import { anchorLeaf, buildMerkleTree, merkleProof } from '@civiledger/chain';
import { keccak256 } from 'viem';
import type { AssuranceLevel, Organization, Prisma } from '@prisma/client';
import type { AppContext } from '../lib/context.js';
import { encrypt, encryptJson, decryptJson, decryptString, blindIndex } from '../lib/crypto.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import { parseCsv } from '../lib/csv.js';
import { allocateStatusSlot, publishStatusList } from './status-list.service.js';
import { jwtPrefix } from './verification.service.js';

/** Claims that identify the person rather than the award. */
const SUBJECT_CLAIMS = [
  'given_name',
  'family_name',
  'name_bn',
  'date_of_birth',
  'national_id_last4',
];

export const MAX_IMPORT_ROWS = 20_000;

export interface ImportIssue {
  claim: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface CreateImportInput {
  organizationId: string;
  vct: string;
  filename: string;
  csv: string;
  assuranceLevel: AssuranceLevel;
  evidence: CredentialEvidence;
  uploadedById: string;
  /** Explicit acknowledgement that this file contains no real graduate data. */
  syntheticData: boolean;
}

export interface ImportSummary {
  id: string;
  rowCount: number;
  readyCount: number;
  conflictCount: number;
}

/**
 * Parse and normalise an upload into a review queue.
 *
 * Nothing is signed here. The registrar keeps the final say on every batch,
 * which is both the honest design and the first thing a university needs to
 * hear (PLAN §19.2).
 */
export async function createImport(
  ctx: AppContext,
  input: CreateImportInput,
): Promise<ImportSummary> {
  // Invariant §25: real personal data requires a signed DPA, in-country
  // hosting and a DPIA first. Until that is configured, refuse anything not
  // declared synthetic — a check, not a note in a README.
  if (!input.syntheticData && !ctx.config.ALLOW_REAL_PERSONAL_DATA) {
    throw forbidden(
      'REAL_DATA_NOT_PERMITTED',
      'this deployment is not cleared for real personal data; see PLAN §18',
    );
  }

  const definition = requireCredentialType(input.vct);
  const table = parseCsv(input.csv, { maxRows: MAX_IMPORT_ROWS });

  const known = new Set(definition.disclosableClaims.map((c) => c.name));
  const unknownColumns = table.headers.filter(
    (h) => !known.has(h) && h !== 'email' && h !== 'phone',
  );

  const rows = table.rows.map((row, index) => {
    const claims = normaliseRow(input.vct, row);
    const issues: ImportIssue[] = validateClaims(input.vct, claims).map((i) => ({
      claim: i.claim,
      message: i.message,
      severity: 'error' as const,
    }));
    for (const column of unknownColumns) {
      if (row[column]) {
        issues.push({
          claim: column,
          message: `column is not part of ${input.vct} and will be ignored`,
          severity: 'warning',
        });
      }
    }
    return { rowNumber: index + 2, raw: row, claims, issues };
  });

  const readyCount = rows.filter((r) => !r.issues.some((i) => i.severity === 'error')).length;

  const created = await ctx.prisma.$transaction(async (tx) => {
    const record = await tx.credentialImport.create({
      data: {
        organizationId: input.organizationId,
        filename: input.filename,
        vct: input.vct,
        state: 'REVIEW',
        rowCount: rows.length,
        readyCount,
        conflictCount: rows.length - readyCount,
        uploadedById: input.uploadedById,
        assuranceLevel: input.assuranceLevel,
        evidenceJson: input.evidence as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.importRow.createMany({
      data: rows.map((row) => ({
        importId: record.id,
        rowNumber: row.rowNumber,
        // Source rows carry names and dates of birth; they are encrypted from
        // the moment they land, not once they become credentials.
        rawEnc: encryptJson(ctx.config.keyRing, row.raw),
        normalisedEnc: encryptJson(ctx.config.keyRing, row.claims),
        issuesJson: row.issues as unknown as Prisma.InputJsonValue,
        state: row.issues.some((i) => i.severity === 'error') ? 'CONFLICT' : 'READY',
      })),
    });

    return record;
  });

  return {
    id: created.id,
    rowCount: rows.length,
    readyCount,
    conflictCount: rows.length - readyCount,
  };
}

/** Coerce CSV strings into the types the frozen vct declares. */
function normaliseRow(vct: string, row: Record<string, string>): Record<string, unknown> {
  const definition = requireCredentialType(vct);
  const claims: Record<string, unknown> = {};

  for (const claim of definition.disclosableClaims) {
    const raw = row[claim.name];
    if (raw === undefined || raw.trim() === '') continue;
    const value = raw.trim();

    switch (claim.type) {
      case 'number':
      case 'integer': {
        const parsed = Number(value);
        claims[claim.name] = Number.isFinite(parsed) ? parsed : value;
        break;
      }
      case 'boolean':
        claims[claim.name] = /^(true|yes|y|1)$/i.test(value);
        break;
      case 'date':
        claims[claim.name] = normaliseDate(value);
        break;
      default:
        claims[claim.name] = claim.enum ? value.toUpperCase().replace(/[\s-]+/g, '_') : value;
    }
  }
  return claims;
}

/** Accept the date formats a Bangladeshi SIS export actually uses. */
function normaliseDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  }
  const ymd = /^(\d{4})[/](\d{1,2})[/](\d{1,2})$/.exec(value);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  }
  // Leave it alone; validateClaims will report it rather than guessing wrong.
  return value;
}

export interface ReviewRow {
  id: string;
  rowNumber: number;
  state: string;
  claims: Record<string, unknown>;
  issues: ImportIssue[];
}

export async function listImportRows(
  ctx: AppContext,
  importId: string,
  organizationId: string,
  options: { state?: string; skip?: number; take?: number } = {},
): Promise<{ total: number; rows: ReviewRow[] }> {
  const record = await ctx.prisma.credentialImport.findUnique({ where: { id: importId } });
  if (!record || record.organizationId !== organizationId) {
    throw notFound('IMPORT_NOT_FOUND', 'import not found');
  }

  const where: Prisma.ImportRowWhereInput = {
    importId,
    ...(options.state ? { state: options.state as never } : {}),
  };
  const [total, rows] = await Promise.all([
    ctx.prisma.importRow.count({ where }),
    ctx.prisma.importRow.findMany({
      where,
      orderBy: { rowNumber: 'asc' },
      skip: options.skip ?? 0,
      take: Math.min(options.take ?? 100, 500),
    }),
  ]);

  return {
    total,
    rows: rows.map((row) => ({
      id: row.id,
      rowNumber: row.rowNumber,
      state: row.state,
      claims: row.normalisedEnc
        ? decryptJson<Record<string, unknown>>(ctx.config.keyRing, row.normalisedEnc)
        : {},
      issues: row.issuesJson as unknown as ImportIssue[],
    })),
  };
}

export interface ApproveBatchInput {
  importId: string;
  organizationId: string;
  approvedById: string;
}

export interface BatchResult {
  batchId: string;
  onChainBatchId: string;
  merkleRoot: string;
  leafCount: number;
  credentialIds: string[];
  /** Status lists republished so the new credentials' status URIs resolve. */
  statusListVersions: Array<{ listId: number; version: number }>;
}

/**
 * Approve an import, sign every ready row, and queue the batch anchor.
 *
 * The whole batch is one database transaction and one outbox row. The previous
 * system anchored first and wrote the database second, so a failed write left
 * an orphaned anchor with nothing to reconcile it against; here the chain write
 * cannot happen unless the rows are committed.
 */
export async function approveAndSignBatch(
  ctx: AppContext,
  input: ApproveBatchInput,
): Promise<BatchResult> {
  const record = await ctx.prisma.credentialImport.findUnique({
    where: { id: input.importId },
    include: { organization: true },
  });
  if (!record || record.organizationId !== input.organizationId) {
    throw notFound('IMPORT_NOT_FOUND', 'import not found');
  }
  if (record.state !== 'REVIEW') {
    throw conflict('IMPORT_NOT_IN_REVIEW', `import is ${record.state}, not REVIEW`);
  }
  // Four eyes. PLAN §17: an issuer insider signing a fake degree can only be
  // detected, and this is the cheapest detection there is.
  if (record.uploadedById === input.approvedById) {
    throw forbidden(
      'FOUR_EYES_REQUIRED',
      'a batch must be approved by someone other than the person who uploaded it',
    );
  }

  const readyRows = await ctx.prisma.importRow.findMany({
    where: { importId: record.id, state: 'READY' },
    orderBy: { rowNumber: 'asc' },
  });
  if (readyRows.length === 0) {
    throw conflict('NOTHING_TO_ISSUE', 'no rows in this import are ready to issue');
  }

  const definition = requireCredentialType(record.vct);
  const evidence = record.evidenceJson as unknown as CredentialEvidence;
  const alwaysVisible: AlwaysVisibleClaims = {
    issuer_name: record.organization.legalName,
    accreditation: record.organization.accreditation,
    assurance_level: toCredentialAssurance(record.assuranceLevel),
    evidence,
  };

  const issuedAt = ctx.now();
  const { signer } = await ctx.signers.forOrganization(record.organizationId);

  const touchedStatusLists = new Set<string>();

  const result = await ctx.prisma.$transaction(
    async (tx) => {
      const batch = await tx.batch.create({
        data: {
          organizationId: record.organizationId,
          state: 'SIGNING',
          preparedById: record.uploadedById,
          approvedById: input.approvedById,
          approvedAt: new Date(issuedAt * 1000),
        },
      });

      const leaves: string[] = [];
      const credentialIds: string[] = [];

      for (const [leafIndex, row] of readyRows.entries()) {
        const claims = decryptJson<Record<string, unknown>>(ctx.config.keyRing, row.normalisedEnc!);
        const subjectId = await upsertSubject(tx, ctx, claims, record.assuranceLevel);

        const slot = await allocateStatusSlot(
          tx,
          ctx,
          record.organizationId,
          record.organization.slug,
        );
        touchedStatusLists.add(slot.statusListId);

        const expiresAt = definition.expires ? issuedAt + 5 * 365 * 24 * 3600 : null;

        const credential = await issueCredential({
          iss: record.organization.issuerUrl,
          vct: record.vct,
          claims,
          alwaysVisible,
          issuedAt,
          expiresAt,
          status: { status_list: { idx: slot.index, uri: slot.uri } },
          signer,
        });

        // The salt is what keeps the on-chain leaf unlinkable. It is generated
        // here, stored encrypted, and never leaves the database (PLAN §11).
        const salt = `0x${randomBytes(32).toString('hex')}`;
        const sdJwtDigest = `0x${createHash('sha256').update(credential.sdJwt, 'utf8').digest('hex')}`;
        leaves.push(anchorLeaf(salt, sdJwtDigest));

        const stored = await tx.credential.create({
          data: {
            organizationId: record.organizationId,
            subjectId,
            vct: record.vct,
            sdJwtEnc: encrypt(ctx.config.keyRing, credential.sdJwt),
            saltEnc: encrypt(ctx.config.keyRing, salt),
            sdJwtDigest,
            jwtPrefix: jwtPrefix(credential.jwt),
            statusListId: slot.statusListId,
            statusIndex: slot.index,
            assuranceLevel: record.assuranceLevel,
            evidenceJson: evidence as unknown as Prisma.InputJsonValue,
            state: 'ISSUED',
            issuedAt: new Date(issuedAt * 1000),
            expiresAt: expiresAt === null ? null : new Date(expiresAt * 1000),
            batchId: batch.id,
            leafIndex,
          },
        });

        await tx.importRow.update({
          where: { id: row.id },
          data: { state: 'ISSUED', subjectId, credentialId: stored.id },
        });
        credentialIds.push(stored.id);
      }

      const tree = buildMerkleTree(leaves);
      const onChainBatchId = computeBatchId(
        record.organization.orgIdHash,
        tree.root,
        leaves.length,
      );
      const manifestUri = `${ctx.config.PUBLIC_BASE_URL}/v1/anchors/${onChainBatchId}`;

      await tx.batch.update({
        where: { id: batch.id },
        data: {
          merkleRoot: tree.root,
          leafCount: leaves.length,
          manifestUri,
          onChainBatchId,
          state: 'ANCHORING',
        },
      });

      await tx.credentialImport.update({
        where: { id: record.id },
        data: { state: 'APPROVED' },
      });

      await tx.outboxEntry.create({
        data: {
          kind: 'ANCHOR_BATCH',
          payload: {
            batchId: batch.id,
            orgId: record.organization.orgIdHash,
            merkleRoot: tree.root,
            leafCount: leaves.length,
            manifestUri,
          },
        },
      });

      await tx.auditEvent.create({
        data: {
          actorUserId: input.approvedById,
          actorType: 'USER',
          action: 'BATCH_APPROVED',
          targetType: 'BATCH',
          targetId: batch.id,
          payloadDigest: tree.root,
        },
      });

      return {
        batchId: batch.id,
        onChainBatchId,
        merkleRoot: tree.root,
        leafCount: leaves.length,
        credentialIds,
      };
    },
    { timeout: 120_000, maxWait: 30_000 },
  );

  // Publish every status list the batch allocated into.
  //
  // Without this the new credentials carry a status URI that does not resolve,
  // and every verification of them degrades to `undetermined` — the system
  // failing closed, correctly, on a batch we simply never finished publishing.
  //
  // Deliberately after the transaction: publishing signs a list and enqueues a
  // chain write, and holding a signing call inside a transaction that already
  // wrote hundreds of rows is how lock timeouts happen.
  const statusListVersions: Array<{ listId: number; version: number }> = [];
  for (const statusListId of touchedStatusLists) {
    const published = await publishStatusList(ctx, statusListId);
    const list = await ctx.prisma.statusList.findUniqueOrThrow({
      where: { id: statusListId },
      select: { listId: true },
    });
    statusListVersions.push({ listId: list.listId, version: published.version });
  }

  return { ...result, statusListVersions };
}

/**
 * Match an incoming row to an existing subject, or create one.
 *
 * Matching is on a blind index over the identifying claims, so two credentials
 * for the same graduate attach to one subject without the database ever being
 * searchable by name.
 */
async function upsertSubject(
  tx: Prisma.TransactionClient,
  ctx: AppContext,
  claims: Record<string, unknown>,
  assurance: AssuranceLevel,
): Promise<string> {
  const identity = SUBJECT_CLAIMS.map((c) => String(claims[c] ?? '')).join('|');
  const index = blindIndex(ctx.config.keyRing, identity);

  const existing = await tx.subject.findUnique({ where: { emailIndex: index } });
  if (existing) return existing.id;

  const created = await tx.subject.create({
    data: {
      displayNameEnc: encrypt(
        ctx.config.keyRing,
        `${String(claims['given_name'] ?? '')} ${String(claims['family_name'] ?? '')}`.trim(),
      ),
      dobEnc:
        claims['date_of_birth'] === undefined
          ? null
          : encrypt(ctx.config.keyRing, String(claims['date_of_birth'])),
      nationalIdEnc:
        claims['national_id_last4'] === undefined
          ? null
          : encrypt(ctx.config.keyRing, String(claims['national_id_last4'])),
      emailIndex: index,
      identityAssurance: assurance,
    },
  });
  return created.id;
}

/** Mirrors AnchorRegistry.batchIdOf — keccak256(abi.encode(orgId, root, count)). */
export function computeBatchId(orgId: string, merkleRoot: string, leafCount: number): string {
  const encoded = `0x${orgId.slice(2)}${merkleRoot.slice(2)}${leafCount.toString(16).padStart(64, '0')}`;
  return keccakHex(encoded);
}

function keccakHex(hex: string): string {
  return keccak256(hex as `0x${string}`);
}

function toCredentialAssurance(level: AssuranceLevel): CredentialAssuranceLevel {
  return level === 'AL3_PLUS' ? 'AL3+' : level;
}

/** Inclusion proof for one credential, for the verification report. */
export async function anchorProofFor(
  ctx: AppContext,
  credentialId: string,
): Promise<{ batchId: string; leaf: string; proof: string[] } | undefined> {
  const credential = await ctx.prisma.credential.findUnique({
    where: { id: credentialId },
    include: { batch: { include: { credentials: true } } },
  });
  if (!credential?.batch?.onChainBatchId || credential.batch.state !== 'PUBLISHED') {
    return undefined;
  }

  // Rebuild the tree in the exact order it was built at signing time. Every
  // credential records its leaf index, so this does not depend on row ordering.
  const siblings = [...credential.batch.credentials].sort(
    (a, b) => (a.leafIndex ?? 0) - (b.leafIndex ?? 0),
  );
  if (siblings.some((c) => c.leafIndex === null)) {
    // A batch signed before leaf indices were recorded. Refusing is correct:
    // a guessed ordering yields a proof that silently fails on chain.
    return undefined;
  }

  const leaves = siblings.map((c) =>
    anchorLeaf(decryptString(ctx.config.keyRing, c.saltEnc), c.sdJwtDigest),
  );
  const tree = buildMerkleTree(leaves);
  const leaf = anchorLeaf(
    decryptString(ctx.config.keyRing, credential.saltEnc),
    credential.sdJwtDigest,
  );

  return {
    batchId: credential.batch.onChainBatchId,
    leaf,
    proof: merkleProof(tree, leaf),
  };
}
