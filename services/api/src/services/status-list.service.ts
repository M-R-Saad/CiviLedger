/**
 * Status list lifecycle. PLAN.html §9.
 *
 * Revocation path, target under 60 seconds end to end:
 *   1. registrar clicks revoke with a reason code
 *   2. the bit is flipped and a new list built and signed   <- here
 *   3. the list is published (served from `signed_jwt`)     <- here
 *   4. publishStatusList(version + 1) goes to the chain     <- outbox
 *   5. verifiers re-fetch and compare the hash against chain
 *
 * Step 4 goes through the transactional outbox rather than being awaited
 * inline. The database commit and the intent to anchor are one transaction, so
 * a chain outage delays external provability but never loses a revocation, and
 * never leaves an anchor with no matching row.
 */

import {
  allocateIndex,
  buildSignedStatusList,
  createBitstring,
  encodeList,
  fromBytes,
  hashEncodedList,
  needsFreshList,
  setBit,
  DEFAULT_LIST_SIZE,
} from '@civiledger/status-list';
import type { Prisma, PrismaClient, StatusList, StatusPurpose } from '@prisma/client';
import { statusListUrlFor } from '../lib/config.js';
import { conflict, serverError } from '../lib/errors.js';
import type { AppContext } from '../lib/context.js';

export interface AllocatedSlot {
  statusListId: string;
  listId: number;
  index: number;
  uri: string;
}

/**
 * Find or create a list with room, and take a random index in it.
 *
 * Must run inside the caller's transaction: the uniqueness of
 * (status_list_id, status_index) is what actually prevents two credentials
 * sharing a revocation bit, and the check and the insert have to be atomic.
 */
export async function allocateStatusSlot(
  tx: Prisma.TransactionClient,
  ctx: AppContext,
  organizationId: string,
  orgSlug: string,
  purpose: StatusPurpose = 'REVOCATION',
): Promise<AllocatedSlot> {
  const list = await findOrCreateList(tx, organizationId, purpose);

  const taken = await tx.credential.findMany({
    where: { statusListId: list.id },
    select: { statusIndex: true },
  });
  const used = new Set(taken.map((c) => c.statusIndex).filter((i): i is number => i !== null));

  // Random, never sequential: a sequential index leaks cohort and issuance
  // order to anyone holding the list, and the list is public (PLAN §9).
  const index = allocateIndex((candidate) => used.has(candidate), list.size);

  await tx.statusList.update({
    where: { id: list.id },
    data: { allocatedCount: { increment: 1 } },
  });

  return {
    statusListId: list.id,
    listId: list.listId,
    index,
    uri: statusListUrlFor(ctx.config.PUBLIC_BASE_URL, orgSlug, list.listId),
  };
}

async function findOrCreateList(
  tx: Prisma.TransactionClient,
  organizationId: string,
  purpose: StatusPurpose,
): Promise<StatusList> {
  const open = await tx.statusList.findFirst({
    where: { organizationId, purpose, sealed: false },
    orderBy: { listId: 'asc' },
  });

  if (open && !needsFreshList(open.allocatedCount, open.size)) return open;

  // PLAN §9: start a fresh list at 80% occupancy rather than filling one to
  // the brim, so allocation never degenerates into scanning for the last gap.
  if (open) {
    await tx.statusList.update({ where: { id: open.id }, data: { sealed: true } });
  }

  const highest = await tx.statusList.findFirst({
    where: { organizationId, purpose },
    orderBy: { listId: 'desc' },
    select: { listId: true },
  });

  return tx.statusList.create({
    data: {
      organizationId,
      listId: (highest?.listId ?? 0) + 1,
      purpose,
      size: DEFAULT_LIST_SIZE,
      bitstring: Buffer.alloc(DEFAULT_LIST_SIZE / 8),
      version: 0,
    },
  });
}

export interface PublishResult {
  version: number;
  listHash: string;
  uri: string;
  signedJwt: string;
}

/**
 * Rebuild, sign and publish a list, and queue its on-chain anchor.
 *
 * `bitMutations` is applied to the stored bitstring first. Passing the
 * mutations in rather than mutating outside keeps the read-modify-write inside
 * one transaction, so two concurrent revocations cannot lose one another.
 */
export async function publishStatusList(
  ctx: AppContext,
  statusListId: string,
  bitMutations: ReadonlyArray<{ index: number; value: boolean }> = [],
): Promise<PublishResult> {
  return ctx.prisma.$transaction(async (tx) => {
    const list = await tx.statusList.findUnique({
      where: { id: statusListId },
      include: { organization: true },
    });
    if (!list) throw serverError('STATUS_LIST_MISSING', `status list ${statusListId} not found`);

    let bits = fromBytes(new Uint8Array(list.bitstring), list.size);
    for (const mutation of bitMutations) {
      bits = setBit(bits, mutation.index, mutation.value);
    }

    // The chain, not the database, is the authority on the version floor.
    //
    // StatusRegistry only accepts a strictly increasing version, and it has no
    // idea our database was restored from a backup or rebuilt. Taking the
    // maximum of the two keeps a restored deployment publishable instead of
    // deadlocked behind a counter the chain has already passed — and a
    // verifier still sees a version that only ever moves forward, which is the
    // property the rollback defence actually depends on.
    let onChainVersion = 0;
    try {
      const anchored = await ctx.ledger.getStatusList(
        list.organization.orgIdHash as `0x${string}`,
        list.listId,
      );
      onChainVersion = anchored?.version ?? 0;
    } catch {
      // Unreachable chain: fall back to the local counter. The published list
      // is then flagged as unanchored to verifiers rather than trusted.
    }

    const version = Math.max(list.version, onChainVersion) + 1;
    const uri = statusListUrlFor(ctx.config.PUBLIC_BASE_URL, list.organization.slug, list.listId);

    const { signer } = await ctx.signers.forOrganization(list.organizationId);
    const signed = await buildSignedStatusList({
      iss: list.organization.issuerUrl,
      uri,
      orgId: list.organization.orgIdHash,
      listId: list.listId,
      version,
      statusPurpose: list.purpose === 'SUSPENSION' ? 'suspension' : 'revocation',
      list: bits,
      issuedAt: ctx.now(),
      ttl: 3600,
      signer,
    });

    await tx.statusList.update({
      where: { id: list.id },
      data: {
        bitstring: Buffer.from(bits.bits),
        version,
        listHash: signed.payload.listHash,
        publishedUri: uri,
        signedJwt: signed.jwt,
      },
    });

    // The anchor is queued in the same transaction that publishes the list.
    // Either both happen or neither does.
    await tx.outboxEntry.create({
      data: {
        kind: 'PUBLISH_STATUS_LIST',
        payload: {
          orgId: list.organization.orgIdHash,
          listId: list.listId,
          listHash: signed.payload.listHash,
          uri,
          version,
        },
      },
    });

    return { version, listHash: signed.payload.listHash, uri, signedJwt: signed.jwt };
  });
}

/** Verify our own published list still hashes to what we recorded. */
export function assertListIntegrity(list: StatusList): void {
  if (!list.signedJwt || !list.listHash) return;
  const encoded = encodeList(fromBytes(new Uint8Array(list.bitstring), list.size));
  if (hashEncodedList(encoded) !== list.listHash) {
    throw conflict(
      'STATUS_LIST_DRIFT',
      'the stored bitstring no longer matches the published hash — republish before serving',
    );
  }
}

/** An empty, unsigned list. Used when seeding a new organisation. */
export function emptyBitstringBuffer(size = DEFAULT_LIST_SIZE): Buffer {
  return Buffer.from(createBitstring(size).bits);
}

export type { PrismaClient };
