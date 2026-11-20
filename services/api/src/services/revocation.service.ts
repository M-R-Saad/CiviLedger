/**
 * Revocation and supersession. PLAN.html §9.
 *
 * Rectification is supersession, never an edit: the old credential is revoked
 * and a corrected one issued (PLAN §18). Nothing already signed is ever
 * rewritten, because a verifier who cached the old credential must still be
 * able to see that it was withdrawn rather than silently changed.
 */

import type { CredentialState } from '@prisma/client';
import type { AppContext } from '../lib/context.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import { publishStatusList } from './status-list.service.js';

/** Reason codes reach the chain as bytes32, so they are never free text. */
export const REVOCATION_REASONS = [
  'ISSUED_IN_ERROR',
  'SUPERSEDED',
  'RECORD_CORRECTED',
  'FRAUD_CONFIRMED',
  'AWARD_RESCINDED',
  'HOLDER_REQUEST',
  'ADMINISTRATIVE',
] as const;
export type RevocationReason = (typeof REVOCATION_REASONS)[number];

export interface RevokeResult {
  credentialId: string;
  state: CredentialState;
  listVersion: number;
  listHash: string;
  /** Seconds from the request to the list being served. */
  elapsedMs: number;
}

export async function revokeCredential(
  ctx: AppContext,
  args: {
    credentialId: string;
    organizationId: string;
    reason: RevocationReason;
    actorUserId: string;
  },
): Promise<RevokeResult> {
  const started = Date.now();

  const credential = await ctx.prisma.credential.findUnique({
    where: { id: args.credentialId },
    select: {
      id: true,
      organizationId: true,
      state: true,
      statusListId: true,
      statusIndex: true,
    },
  });
  if (!credential) throw notFound('CREDENTIAL_NOT_FOUND', 'credential not found');
  if (credential.organizationId !== args.organizationId) {
    throw forbidden('NOT_YOUR_CREDENTIAL', 'this credential belongs to another institution');
  }
  if (credential.state === 'REVOKED') {
    throw conflict('ALREADY_REVOKED', 'credential is already revoked');
  }
  if (credential.statusListId === null || credential.statusIndex === null) {
    throw conflict(
      'NO_STATUS_SLOT',
      'this credential has no status-list slot and cannot be revoked; supersede it instead',
    );
  }

  const previousState = credential.state;

  await ctx.prisma.$transaction(async (tx) => {
    await tx.credential.update({
      where: { id: credential.id },
      data: {
        state: 'REVOKED',
        revokedAt: new Date(ctx.now() * 1000),
        revokedReason: args.reason,
      },
    });
    await tx.credentialStatusEvent.create({
      data: {
        credentialId: credential.id,
        previousState,
        newState: 'REVOKED',
        reasonCode: args.reason,
        actorUserId: args.actorUserId,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: args.actorUserId,
        actorType: 'USER',
        action: 'CREDENTIAL_REVOKED',
        targetType: 'CREDENTIAL',
        targetId: credential.id,
      },
    });
  });

  // Flip the bit and republish. The new list is served immediately; its
  // on-chain version follows through the outbox. A verifier that fetches in
  // between sees a signed list newer than its anchor and is told so — it is
  // never shown a stale "valid".
  const published = await publishStatusList(ctx, credential.statusListId, [
    { index: credential.statusIndex, value: true },
  ]);

  return {
    credentialId: credential.id,
    state: 'REVOKED',
    listVersion: published.version,
    listHash: published.listHash,
    elapsedMs: Date.now() - started,
  };
}

/**
 * Lift a suspension. Deliberately narrow: only a credential suspended by this
 * institution can be reinstated, and a revocation can never be undone — an
 * un-revokable status service is the thing the ledger exists to rule out.
 */
export async function reinstateCredential(
  ctx: AppContext,
  args: { credentialId: string; organizationId: string; actorUserId: string },
): Promise<RevokeResult> {
  const started = Date.now();
  const credential = await ctx.prisma.credential.findUnique({
    where: { id: args.credentialId },
    select: {
      id: true,
      organizationId: true,
      state: true,
      statusListId: true,
      statusIndex: true,
    },
  });
  if (!credential) throw notFound('CREDENTIAL_NOT_FOUND', 'credential not found');
  if (credential.organizationId !== args.organizationId) {
    throw forbidden('NOT_YOUR_CREDENTIAL', 'this credential belongs to another institution');
  }
  if (credential.state === 'REVOKED') {
    throw conflict(
      'REVOCATION_IS_FINAL',
      'a revoked credential cannot be reinstated; issue a replacement instead',
    );
  }
  if (credential.state !== 'SUSPENDED') {
    throw conflict('NOT_SUSPENDED', `credential is ${credential.state}, not SUSPENDED`);
  }

  await ctx.prisma.$transaction(async (tx) => {
    await tx.credential.update({
      where: { id: credential.id },
      data: { state: 'ISSUED', revokedAt: null, revokedReason: null },
    });
    await tx.credentialStatusEvent.create({
      data: {
        credentialId: credential.id,
        previousState: 'SUSPENDED',
        newState: 'ISSUED',
        reasonCode: 'ADMINISTRATIVE',
        actorUserId: args.actorUserId,
      },
    });
  });

  const published = await publishStatusList(ctx, credential.statusListId!, [
    { index: credential.statusIndex!, value: false },
  ]);

  return {
    credentialId: credential.id,
    state: 'ISSUED',
    listVersion: published.version,
    listHash: published.listHash,
    elapsedMs: Date.now() - started,
  };
}
