/**
 * Verification. PLAN.html §5.3, §10, §15.
 *
 * The API wires @civiledger/verifier to this deployment's chain and status-list
 * storage, records a consent receipt, and returns the report. The checking
 * itself lives in the open library so a third party can reproduce this answer
 * without us (PLAN §16).
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  verifyPresentation,
  type IssuerDirectory,
  type StatusListSource,
  type VerificationReport,
} from '@civiledger/verifier';
import type { JwkPublicEc } from '@civiledger/credential';
import type { VerificationOutcome } from '@prisma/client';
import type { AppContext } from '../lib/context.js';
import { encryptJson, toBytes } from '../lib/crypto.js';
import { anchorProofFor } from './issuance.service.js';

/** Resolve issuers from the live chain, falling back to nothing (never to a guess). */
export function chainIssuerDirectory(ctx: AppContext): IssuerDirectory {
  return {
    basis: 'live',
    async resolve(iss: string, signedAtSeconds: number) {
      const org = await ctx.prisma.organization.findUnique({
        where: { issuerUrl: iss },
        include: { issuerKeys: { orderBy: { epoch: 'asc' } } },
      });
      if (!org) return undefined;

      // The chain is authoritative for key validity; the database only holds
      // the public JWK matching the thumbprint the chain vouches for.
      const onChain = await ctx.ledger.keyAt(org.orgIdHash as `0x${string}`, signedAtSeconds);
      if (onChain.thumbprint === `0x${'0'.repeat(64)}`) return undefined;

      const key = org.issuerKeys.find((k) => k.jwkThumbprint === onChain.thumbprint);
      if (!key) return undefined;

      const issuer = await ctx.ledger.getIssuer(org.orgIdHash as `0x${string}`);

      return {
        orgId: org.orgIdHash,
        name: org.legalName,
        didWeb: issuer.didWeb || org.didWeb,
        accreditation: issuer.accreditation,
        status: issuer.status,
        jwk: key.publicJwk as unknown as JwkPublicEc,
        keyThumbprint: key.jwkThumbprint,
        validAtSigningTime: onChain.valid,
        ...(onChain.reason === undefined ? {} : { revocationReason: onChain.reason }),
      };
    },
  };
}

/** Serve status lists from our own storage, and their anchors from the chain. */
export function localStatusListSource(ctx: AppContext): StatusListSource {
  return {
    async fetch(uri: string) {
      const list = await ctx.prisma.statusList.findFirst({
        where: { publishedUri: uri },
        select: { signedJwt: true },
      });
      return list?.signedJwt ?? undefined;
    },
    async onChain(orgId: string, listId: number) {
      const record = await ctx.ledger.getStatusList(orgId as `0x${string}`, listId);
      return record
        ? {
            listHash: record.listHash,
            uri: record.uri,
            version: record.version,
            updatedAt: record.updatedAt,
          }
        : undefined;
    },
  };
}

export interface VerifyInput {
  sdJwt: string;
  /** Present when the presentation came through a share link. */
  shareToken?: string;
  verifierId?: string;
  expectedAudience?: string;
  expectedNonce?: string;
  requireKeyBinding?: boolean;
  /** False for the public preview endpoint, which records nothing. */
  record: boolean;
}

export interface VerifyOutput {
  report: VerificationReport;
  verificationId?: string;
  reportId?: string;
}

export async function verify(ctx: AppContext, input: VerifyInput): Promise<VerifyOutput> {
  const credential = await findCredentialForPresentation(ctx, input.sdJwt);

  const anchor = credential ? await anchorProofFor(ctx, credential.id) : undefined;

  const report = await verifyPresentation({
    sdJwt: input.sdJwt,
    issuers: chainIssuerDirectory(ctx),
    statusLists: localStatusListSource(ctx),
    versionFloor: ctx.versionFloor,
    now: ctx.now(),
    ...(anchor
      ? {
          anchor,
          anchors: {
            verify: async (proof) =>
              ctx.ledger.verifyInclusion(
                proof.batchId as `0x${string}`,
                proof.leaf as `0x${string}`,
                proof.proof as `0x${string}`[],
              ),
          },
        }
      : {}),
    ...(input.expectedAudience === undefined ? {} : { expectedAudience: input.expectedAudience }),
    ...(input.expectedNonce === undefined ? {} : { expectedNonce: input.expectedNonce }),
    ...(input.requireKeyBinding === undefined
      ? {}
      : { requireKeyBinding: input.requireKeyBinding }),
  });

  if (!input.record) return { report };

  const stored = await recordVerification(
    ctx,
    input,
    report,
    credential?.id,
    credential?.subjectId,
  );
  return { report, verificationId: stored.id, reportId: stored.id };
}

/**
 * Persist the verification and its consent receipt.
 *
 * Never written to the chain. Per-presentation on-chain writes would publish a
 * verification graph — who checked whom, when — which invariant §25 forbids
 * outright. A nightly Merkle root over these receipts is anchored instead.
 */
async function recordVerification(
  ctx: AppContext,
  input: VerifyInput,
  report: VerificationReport,
  credentialId: string | undefined,
  subjectId: string | undefined,
): Promise<{ id: string }> {
  const now = new Date(ctx.now() * 1000);
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + ctx.config.RECEIPT_RETENTION_MONTHS);

  return ctx.prisma.$transaction(async (tx) => {
    const shareLink = input.shareToken
      ? await tx.shareLink.findUnique({ where: { tokenHash: hashToken(input.shareToken) } })
      : null;

    const verification = await tx.verification.create({
      data: {
        credentialId: credentialId ?? null,
        verifierId: input.verifierId ?? null,
        shareLinkId: shareLink?.id ?? null,
        claimScope: Object.keys(report.claims),
        result: report.result.toUpperCase() as VerificationOutcome,
        failureCode: report.failureCode ?? null,
        basis: report.basis,
        reportEnc: encryptJson(ctx.config.keyRing, report),
      },
    });

    if (subjectId) {
      const receipt = {
        verificationId: verification.id,
        verifier: input.verifierId ?? 'anonymous',
        purpose: shareLink?.purpose ?? 'AD_HOC',
        claimsDisclosed: Object.keys(report.claims),
        result: report.result,
        at: now.toISOString(),
      };
      const digest = createHash('sha256').update(canonicalJson(receipt), 'utf8').digest('hex');

      await tx.consentReceipt.create({
        data: {
          verificationId: verification.id,
          subjectId,
          receiptDigest: `0x${digest}`,
          receiptEnc: encryptJson(ctx.config.keyRing, receipt),
          expiresAt,
        },
      });
    }

    if (shareLink) {
      await tx.shareLink.update({
        where: { id: shareLink.id },
        data: { useCount: { increment: 1 } },
      });
    }

    return { id: verification.id };
  });
}

/**
 * Find the credential a presentation came from, by digesting its issuer-signed
 * JWT. Used only to locate an anchor proof and the subject for the receipt —
 * verification itself never depends on our database.
 */
async function findCredentialForPresentation(
  ctx: AppContext,
  sdJwt: string,
): Promise<{ id: string; subjectId: string } | undefined> {
  const jwt = sdJwt.split('~')[0];
  if (!jwt) return undefined;

  // The stored digest covers the whole issued SD-JWT, but a narrowed
  // presentation carries fewer disclosures — so match on the issuer-signed JWT,
  // which selective disclosure leaves untouched.
  const match = await ctx.prisma.credential.findFirst({
    where: { jwtPrefix: jwtPrefix(jwt) },
    select: { id: true, subjectId: true },
  });
  return match ?? undefined;
}

/** A short, non-secret handle for the issuer-signed JWT. */
export function jwtPrefix(jwt: string): string {
  return createHash('sha256').update(jwt, 'utf8').digest('hex').slice(0, 32);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('base64url');
}

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function constantTimeEquals(a: string, b: string): boolean {
  const left = toBytes(a);
  const right = toBytes(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** RFC 8785-style canonical JSON, enough for receipt digests. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export type { VerificationReport };
