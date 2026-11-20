/**
 * Application errors, rendered as RFC 9457 problem+json.
 *
 * Every error carries a stable machine `code`. Clients translate codes; the
 * API never emits user-facing English, so the same failure reads correctly in
 * Bangla and in English (a discipline inherited from the previous system's
 * verification service, which was the one thing in it worth keeping).
 */

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, message: string, details?: Record<string, unknown>) =>
  new AppError(400, code, message, details);

export const unauthorized = (code = 'UNAUTHENTICATED', message = 'authentication required') =>
  new AppError(401, code, message);

export const forbidden = (code = 'FORBIDDEN', message = 'not permitted') =>
  new AppError(403, code, message);

export const notFound = (code = 'NOT_FOUND', message = 'not found') =>
  new AppError(404, code, message);

export const conflict = (code: string, message: string, details?: Record<string, unknown>) =>
  new AppError(409, code, message, details);

export const gone = (code: string, message: string) => new AppError(410, code, message);

export const tooManyRequests = (code = 'RATE_LIMITED', message = 'too many requests') =>
  new AppError(429, code, message);

export const serverError = (code: string, message: string) => new AppError(500, code, message);

/**
 * Field names that must never reach a log line or an error body.
 * PLAN §17, "PII in logs or error traces". Enforced by `redact` below and by a
 * CI check over log call sites.
 */
export const PII_FIELDS = [
  'given_name',
  'family_name',
  'name_bn',
  'displayName',
  'display_name',
  'date_of_birth',
  'dob',
  'national_id',
  'national_id_last4',
  'nationalId',
  'email',
  'phone',
  'password',
  'passwordHash',
  'sdJwt',
  'sd_jwt',
  'salt',
  'privateJwk',
  'apiKey',
  'token',
  'authorization',
  'cookie',
] as const;

const PII_SET = new Set<string>(PII_FIELDS.map((f) => f.toLowerCase()));

/** Recursively replace known personal fields with a marker. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    out[key] = PII_SET.has(key.toLowerCase()) ? '[redacted]' : redact(inner, depth + 1);
  }
  return out;
}
