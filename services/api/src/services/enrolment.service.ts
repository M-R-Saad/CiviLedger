/**
 * Wallet enrolment. PLAN.html §5.3 ("notify graduates"), §12.2.
 *
 * Issuance creates a subject from the institution's record; the graduate has
 * no account at that point and could not reach their own credential. This
 * closes that loop.
 *
 * The institution issues a one-time token and delivers it out of band. That
 * out-of-band step is the identity check: we are not verifying who the person
 * is, the institution is, using a channel it already has for that graduate.
 * The assurance level on the credential already records how rigorous that was.
 *
 * The same path is loss recovery (PLAN §12.2): re-identify the person, issue a
 * fresh invite, and the old session is revoked when the new login is attached.
 */

import { createHash, randomBytes } from 'node:crypto';
import type { AppContext } from '../lib/context.js';
import { blindIndex, encrypt } from '../lib/crypto.js';
import { badRequest, conflict, forbidden, gone, notFound } from '../lib/errors.js';
import { hashPassword } from './auth.service.js';

/** Long enough to be unguessable, short enough to read down a phone line. */
const INVITE_TTL_HOURS = 14 * 24;

export interface EnrolmentInviteCreated {
  token: string;
  expiresAt: string;
  subjectId: string;
}

export async function createEnrolmentInvite(
  ctx: AppContext,
  args: { credentialId: string; organizationId: string; actorUserId: string },
): Promise<EnrolmentInviteCreated> {
  const credential = await ctx.prisma.credential.findUnique({
    where: { id: args.credentialId },
    select: { organizationId: true, subjectId: true },
  });
  if (!credential) throw notFound('CREDENTIAL_NOT_FOUND', 'credential not found');
  if (credential.organizationId !== args.organizationId) {
    throw forbidden('NOT_YOUR_CREDENTIAL', 'this credential belongs to another institution');
  }

  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date((ctx.now() + INVITE_TTL_HOURS * 3600) * 1000);

  await ctx.prisma.$transaction(async (tx) => {
    // One live invite per subject. A graduate holding two valid tokens is two
    // chances for the wrong one to be intercepted.
    await tx.enrolmentInvite.deleteMany({
      where: { subjectId: credential.subjectId, redeemedAt: null },
    });
    await tx.enrolmentInvite.create({
      data: {
        subjectId: credential.subjectId,
        tokenHash: hashInvite(token),
        expiresAt,
        createdById: args.actorUserId,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: args.actorUserId,
        actorType: 'USER',
        action: 'ENROLMENT_INVITED',
        targetType: 'SUBJECT',
        targetId: credential.subjectId,
      },
    });
  });

  return { token, expiresAt: expiresAt.toISOString(), subjectId: credential.subjectId };
}

export interface EnrolledHolder {
  subjectId: string;
  displayName: string;
}

export async function redeemEnrolmentInvite(
  ctx: AppContext,
  args: { token: string; email: string; password: string },
): Promise<EnrolledHolder> {
  if (args.password.length < 12) {
    throw badRequest('PASSWORD_TOO_SHORT', 'choose a password of at least 12 characters');
  }

  const invite = await ctx.prisma.enrolmentInvite.findUnique({
    where: { tokenHash: hashInvite(args.token) },
    include: { subject: true },
  });
  if (!invite) throw notFound('INVITE_NOT_FOUND', 'this invitation is not valid');
  if (invite.redeemedAt) throw gone('INVITE_ALREADY_USED', 'this invitation has already been used');
  if (invite.expiresAt.getTime() <= ctx.now() * 1000) {
    throw gone('INVITE_EXPIRED', 'this invitation has expired; ask your institution for a new one');
  }
  if (invite.subject.erasedAt) {
    throw gone('ACCOUNT_ERASED', 'this record has been erased');
  }

  const emailIndex = blindIndex(ctx.config.keyRing, args.email);
  const taken = await ctx.prisma.subject.findUnique({ where: { emailIndex } });
  if (taken && taken.id !== invite.subjectId) {
    throw conflict('EMAIL_IN_USE', 'that email address is already attached to another account');
  }

  await ctx.prisma.$transaction(async (tx) => {
    await tx.subject.update({
      where: { id: invite.subjectId },
      data: {
        emailEnc: encrypt(ctx.config.keyRing, args.email.trim().toLowerCase()),
        emailIndex,
        passwordHash: await hashPassword(args.password),
      },
    });
    await tx.enrolmentInvite.update({
      where: { id: invite.id },
      data: { redeemedAt: new Date(ctx.now() * 1000) },
    });
    // Re-enrolment is also the loss-recovery path, so any session opened
    // against the previous login stops here.
    await tx.session.updateMany({
      where: { subjectId: invite.subjectId, revokedAt: null },
      data: { revokedAt: new Date(ctx.now() * 1000) },
    });
  });

  return {
    subjectId: invite.subjectId,
    displayName: '',
  };
}

function hashInvite(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('base64url');
}
