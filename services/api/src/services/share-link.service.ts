/**
 * Time-boxed, claim-scoped share links. PLAN.html §15 (wallet), §17.
 *
 * A share link is the wallet's answer to "send my degree to this employer"
 * without the employer needing an app. It is also the most obvious replay
 * target in the system, so four things are true of every link:
 *
 *   - the token is stored hashed, so a database read cannot mint a presentation
 *   - it carries a claim scope, enforced here and not merely in the UI (§25)
 *   - it has a short TTL and a use count
 *   - it names a purpose, which is recorded in the consent receipt
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { presentCredential } from '@civiledger/credential';
import { requireCredentialType } from '@civiledger/credential';
import type { AppContext } from '../lib/context.js';
import { decryptString, toBytes } from '../lib/crypto.js';
import { badRequest, forbidden, gone, notFound } from '../lib/errors.js';

export interface CreateShareLinkInput {
  credentialId: string;
  subjectId: string;
  claimScope: string[];
  purpose: string;
  ttlMinutes: number;
  maxUses: number;
}

export interface ShareLinkCreated {
  token: string;
  url: string;
  expiresAt: string;
  claimScope: string[];
  maxUses: number;
}

export async function createShareLink(
  ctx: AppContext,
  input: CreateShareLinkInput,
): Promise<ShareLinkCreated> {
  const credential = await ctx.prisma.credential.findUnique({
    where: { id: input.credentialId },
    select: { id: true, subjectId: true, vct: true, state: true },
  });
  if (!credential) throw notFound('CREDENTIAL_NOT_FOUND', 'credential not found');
  if (credential.subjectId !== input.subjectId) {
    throw forbidden('NOT_YOUR_CREDENTIAL', 'this credential is not yours');
  }
  if (credential.state === 'REVOKED') {
    // Sharing a revoked credential is not forbidden by the protocol — the
    // verifier would see the revocation — but offering to do it is a trap for
    // the holder, who would be handing over a document that reads as fraud.
    throw badRequest('CREDENTIAL_REVOKED', 'this credential has been revoked and cannot be shared');
  }

  const definition = requireCredentialType(credential.vct);
  const known = new Set(definition.disclosableClaims.map((c) => c.name));
  const scope = [...new Set(input.claimScope)].filter((c) => known.has(c));
  if (scope.length === 0) {
    throw badRequest('EMPTY_CLAIM_SCOPE', 'a share link must disclose at least one claim');
  }
  const unknown = input.claimScope.filter((c) => !known.has(c));
  if (unknown.length > 0) {
    throw badRequest('UNKNOWN_CLAIMS', `not part of ${credential.vct}: ${unknown.join(', ')}`, {
      claims: unknown,
    });
  }

  const ttl = Math.min(input.ttlMinutes, ctx.config.SHARE_LINK_MAX_TTL_MINUTES);
  if (ttl < 1) throw badRequest('BAD_TTL', 'a share link must last at least a minute');
  const maxUses = Math.min(Math.max(input.maxUses, 1), 20);

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date((ctx.now() + ttl * 60) * 1000);

  await ctx.prisma.shareLink.create({
    data: {
      tokenHash: hashToken(token),
      credentialId: credential.id,
      claimScope: scope,
      purpose: input.purpose,
      expiresAt,
      maxUses,
    },
  });

  return {
    token,
    url: `${ctx.config.VERIFY_ORIGIN.replace(/\/$/, '')}/v/${token}`,
    expiresAt: expiresAt.toISOString(),
    claimScope: scope,
    maxUses,
  };
}

export interface ResolvedShareLink {
  shareLinkId: string;
  credentialId: string;
  purpose: string;
  claimScope: string[];
  /** The SD-JWT narrowed to the agreed claim scope. */
  presentation: string;
  remainingUses: number;
}

/**
 * Turn a share token into a presentation.
 *
 * The narrowing happens here, on the server, from the scope stored at creation
 * time. A verifier cannot receive a claim the holder did not agree to disclose,
 * whatever it asks for (invariant §25).
 */
export async function resolveShareLink(ctx: AppContext, token: string): Promise<ResolvedShareLink> {
  const link = await ctx.prisma.shareLink.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { credential: true },
  });
  if (!link) throw notFound('SHARE_LINK_NOT_FOUND', 'this link is not valid');
  if (link.revokedAt) throw gone('SHARE_LINK_REVOKED', 'this link was withdrawn by its holder');
  if (link.expiresAt.getTime() <= ctx.now() * 1000) {
    throw gone('SHARE_LINK_EXPIRED', 'this link has expired');
  }
  if (link.useCount >= link.maxUses) {
    throw gone('SHARE_LINK_USED_UP', 'this link has already been used');
  }

  const sdJwt = decryptString(ctx.config.keyRing, link.credential.sdJwtEnc);
  const presentation = await presentCredential({
    issuedSdJwt: sdJwt,
    claimScope: link.claimScope,
  });

  return {
    shareLinkId: link.id,
    credentialId: link.credentialId,
    purpose: link.purpose,
    claimScope: link.claimScope,
    presentation,
    remainingUses: link.maxUses - link.useCount,
  };
}

/**
 * Withdraw a link by its id.
 *
 * By id rather than by token on purpose: the token is returned once, at
 * creation, and never stored anywhere the holder can read it again. Requiring
 * it here would mean either showing it a second time or making withdrawal
 * impossible, and the first of those turns the wallet's link list into a set
 * of live credentials behind one session.
 */
export async function revokeShareLink(
  ctx: AppContext,
  shareLinkId: string,
  subjectId: string,
): Promise<void> {
  const link = await ctx.prisma.shareLink.findUnique({
    where: { id: shareLinkId },
    include: { credential: { select: { subjectId: true } } },
  });
  if (!link) throw notFound('SHARE_LINK_NOT_FOUND', 'this link is not valid');
  if (link.credential.subjectId !== subjectId) {
    throw forbidden('NOT_YOUR_LINK', 'this link is not yours');
  }
  if (link.revokedAt) return;

  await ctx.prisma.shareLink.update({
    where: { id: link.id },
    data: { revokedAt: new Date(ctx.now() * 1000) },
  });
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('base64url');
}

export function safeTokenEquals(a: string, b: string): boolean {
  const left = toBytes(a);
  const right = toBytes(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
