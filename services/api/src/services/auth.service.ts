/**
 * Authentication for staff, verifiers and wallet holders.
 *
 * Three deliberate departures from the system this replaces:
 *
 *   - Sessions are opaque tokens stored hashed, not self-contained JWTs. A JWT
 *     froze the caller's role and organisation for its whole lifetime, so
 *     suspending an institution did nothing until the token expired. Here every
 *     request re-reads the user, and a suspension bites immediately.
 *   - Passwords are Argon2id, not bcrypt at cost 10.
 *   - Email is stored encrypted with a blind index, so the table is not
 *     searchable by address and a database leak does not hand over a mailing
 *     list of every graduate.
 */

import argon2 from 'argon2';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Prisma, User, UserRole } from '@prisma/client';
import type { AppContext } from '../lib/context.js';
import { blindIndex, decryptString, encrypt, toBytes } from '../lib/crypto.js';
import { forbidden, unauthorized } from '../lib/errors.js';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export interface Principal {
  kind: 'user' | 'verifier' | 'subject';
  id: string;
  role?: UserRole;
  organizationId?: string;
  verifierId?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export interface LoginResult {
  token: string;
  expiresAt: string;
  principal: Principal;
  displayName: string;
}

export async function loginUser(
  ctx: AppContext,
  email: string,
  password: string,
): Promise<LoginResult> {
  const index = blindIndex(ctx.config.keyRing, email);
  const user = await ctx.prisma.user.findUnique({
    where: { emailIndex: index },
    include: { organization: true },
  });

  // Always spend the verification cost, even when there is no such user, so a
  // timing difference does not tell an attacker which addresses are registered.
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const ok = await verifyPassword(hash, password);

  if (!user || !ok) throw unauthorized('BAD_CREDENTIALS', 'email or password is incorrect');
  if (user.disabledAt) throw forbidden('ACCOUNT_DISABLED', 'this account has been disabled');
  if (user.organization && user.organization.status !== 'ACTIVE') {
    throw forbidden('ORGANISATION_INACTIVE', 'your institution is not active');
  }

  const session = await createSession(ctx, { userId: user.id });
  await ctx.prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(ctx.now() * 1000) },
  });

  return {
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    principal: {
      kind: 'user',
      id: user.id,
      role: user.role,
      ...(user.organizationId ? { organizationId: user.organizationId } : {}),
      ...(user.verifierId ? { verifierId: user.verifierId } : {}),
    },
    displayName: decryptString(ctx.config.keyRing, user.displayNameEnc),
  };
}

/**
 * A fixed Argon2id hash of a random value, used as the comparison target when
 * no user matched. Generated once at module load.
 */
const DUMMY_HASH = await argon2.hash(randomBytes(32).toString('hex'), ARGON2_OPTIONS);

async function createSession(
  ctx: AppContext,
  owner: { userId: string } | { subjectId: string },
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date((ctx.now() + ctx.config.SESSION_TTL_HOURS * 3600) * 1000);

  await ctx.prisma.session.create({
    data: { ...owner, tokenHash: hashSessionToken(token), expiresAt },
  });
  return { token, expiresAt };
}

/**
 * Resolve a bearer token to a principal, re-reading the user every time.
 *
 * This is the reason sessions are opaque: role, organisation and suspension
 * state are read fresh on every request, so revoking access takes effect now
 * rather than whenever a token happens to expire.
 */
export async function resolveSession(ctx: AppContext, token: string): Promise<Principal> {
  const session = await ctx.prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: { include: { organization: true } }, subject: true },
  });

  if (!session || session.revokedAt) throw unauthorized('SESSION_INVALID', 'session is not valid');
  if (session.expiresAt.getTime() <= ctx.now() * 1000) {
    throw unauthorized('SESSION_EXPIRED', 'session has expired');
  }

  if (session.subject) {
    if (session.subject.erasedAt) {
      throw forbidden('ACCOUNT_ERASED', 'this account has been erased');
    }
    return { kind: 'subject', id: session.subject.id };
  }

  const user = session.user;
  if (!user) throw unauthorized('SESSION_INVALID', 'session is not valid');
  if (user.disabledAt) throw forbidden('ACCOUNT_DISABLED', 'this account has been disabled');
  if (user.organization && user.organization.status !== 'ACTIVE') {
    throw forbidden('ORGANISATION_INACTIVE', 'your institution is not active');
  }

  return {
    kind: 'user',
    id: user.id,
    role: user.role,
    ...(user.organizationId ? { organizationId: user.organizationId } : {}),
    ...(user.verifierId ? { verifierId: user.verifierId } : {}),
  };
}

/**
 * Sign a graduate into the hosted wallet.
 *
 * v1 is custodial by design (PLAN §3): consumer wallet adoption is the hardest
 * distribution problem there is, so self-custody is an upgrade for those who
 * want it rather than a prerequisite for anyone.
 */
export async function loginSubject(
  ctx: AppContext,
  email: string,
  password: string,
): Promise<LoginResult> {
  const index = blindIndex(ctx.config.keyRing, email);
  const subject = await ctx.prisma.subject.findUnique({ where: { emailIndex: index } });

  const hash = subject?.passwordHash ?? DUMMY_HASH;
  const ok = await verifyPassword(hash, password);

  if (!subject || !ok) throw unauthorized('BAD_CREDENTIALS', 'email or password is incorrect');
  if (subject.erasedAt) throw forbidden('ACCOUNT_ERASED', 'this account has been erased');

  const session = await createSession(ctx, { subjectId: subject.id });
  return {
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    principal: { kind: 'subject', id: subject.id },
    displayName: decryptString(ctx.config.keyRing, subject.displayNameEnc),
  };
}

export async function revokeSession(ctx: AppContext, token: string): Promise<void> {
  await ctx.prisma.session
    .update({
      where: { tokenHash: hashSessionToken(token) },
      data: { revokedAt: new Date(ctx.now() * 1000) },
    })
    .catch(() => undefined);
}

/** Resolve a verifier API key. Keys are `clv_<prefix>_<secret>`. */
export async function resolveApiKey(ctx: AppContext, key: string): Promise<Principal> {
  const verifier = await ctx.prisma.verifier.findUnique({
    where: { apiKeyHash: hashSessionToken(key) },
  });
  if (!verifier) throw unauthorized('BAD_API_KEY', 'API key is not valid');
  if (verifier.kybStatus !== 'VERIFIED') {
    // PLAN §17: a phishing verifier harvesting credentials is stopped by KYB
    // before API access, not by anything downstream.
    throw forbidden('KYB_REQUIRED', 'this verifier has not completed business verification');
  }
  return { kind: 'verifier', id: verifier.id, verifierId: verifier.id };
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const prefix = randomBytes(4).toString('hex');
  const secret = randomBytes(24).toString('base64url');
  const key = `clv_${prefix}_${secret}`;
  return { key, prefix, hash: hashSessionToken(key) };
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('base64url');
}

export function safeEquals(a: string, b: string): boolean {
  const left = toBytes(a);
  const right = toBytes(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  organizationId?: string;
  verifierId?: string;
}

export async function createUser(
  ctx: AppContext,
  input: CreateUserInput,
  tx?: Prisma.TransactionClient,
): Promise<User> {
  const client = tx ?? ctx.prisma;
  return client.user.create({
    data: {
      emailIndex: blindIndex(ctx.config.keyRing, input.email),
      emailEnc: encrypt(ctx.config.keyRing, input.email.trim().toLowerCase()),
      displayNameEnc: encrypt(ctx.config.keyRing, input.displayName),
      passwordHash: await hashPassword(input.password),
      role: input.role,
      organizationId: input.organizationId ?? null,
      verifierId: input.verifierId ?? null,
    },
  });
}

/** Roles permitted to perform each console action. */
export const ROLE_CAPABILITIES: Record<UserRole, readonly string[]> = {
  REGISTRAR: ['import:create', 'import:read', 'credential:read', 'analytics:read'],
  EXAM_CONTROLLER: [
    'import:create',
    'import:read',
    'batch:approve',
    'credential:read',
    'credential:revoke',
    'analytics:read',
  ],
  ORG_ADMIN: [
    'import:read',
    'batch:approve',
    'credential:read',
    'credential:revoke',
    'analytics:read',
    'org:manage',
  ],
  VERIFIER_STAFF: ['verify:record', 'verify:read'],
  OVERSIGHT: ['audit:read', 'registry:read'],
  PLATFORM_ADMIN: ['registry:read', 'org:manage', 'audit:read', 'governance:propose'],
};

export function can(principal: Principal, capability: string): boolean {
  if (principal.kind === 'verifier') {
    return capability === 'verify:record' || capability === 'verify:read';
  }
  if (!principal.role) return false;
  return ROLE_CAPABILITIES[principal.role].includes(capability);
}

export function requireCapability(principal: Principal, capability: string): void {
  if (!can(principal, capability)) {
    throw forbidden('MISSING_CAPABILITY', `this action requires ${capability}`);
  }
}
