/**
 * Configuration, validated once at boot.
 *
 * The API refuses to start on a bad or missing secret rather than failing at
 * the first request that needs it — a server that boots without a signing key
 * and then 500s on login is worse than one that never came up.
 */

import { z } from 'zod';
import { createKeyRing, type KeyRing } from './crypto.js';

const base64Key = z.string().regex(/^[A-Za-z0-9+/]{43}=$/, 'must be 32 bytes of base64');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().url(),

  /** Public base URL. Status list and issuer URLs are built from it. */
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:4000'),
  /** Where the three front ends live, for CORS and share links. */
  CONSOLE_ORIGIN: z.string().url().default('http://localhost:5173'),
  VERIFY_ORIGIN: z.string().url().default('http://localhost:5174'),
  WALLET_ORIGIN: z.string().url().default('http://localhost:5175'),

  /** `keyId:base64key`, comma-separated, newest last. */
  DATA_ENCRYPTION_KEYS: z.string().min(1),
  BLIND_INDEX_KEY: base64Key,
  /** Signs session tokens. Rotating it logs everyone out, which is intended. */
  SESSION_SECRET: base64Key,

  CHAIN_RPC_URL: z.string().url().default('http://127.0.0.1:8545'),
  CHAIN_ID: z.coerce.number().int().positive().default(1337),
  CHAIN_EXPLORER_URL: z.string().url().optional(),
  /** Path to the deploy script's address book. */
  DEPLOYMENTS_FILE: z.string().optional(),

  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(24).default(8),
  /** PLAN §10 proposes 24 months for consent receipts. */
  RECEIPT_RETENTION_MONTHS: z.coerce.number().int().positive().default(24),
  SHARE_LINK_MAX_TTL_MINUTES: z.coerce.number().int().positive().default(10_080),

  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  VERIFY_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),

  /**
   * Gate on touching real graduate data. PLAN §18 and invariant §25: a signed
   * DPA, an in-country deployment and a DPIA come first. Until this is set, the
   * API refuses to import anything not marked synthetic.
   */
  ALLOW_REAL_PERSONAL_DATA: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  ENABLE_DOCS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export type RawConfig = z.infer<typeof schema>;

export interface AppConfig extends RawConfig {
  keyRing: KeyRing;
  sessionSecret: Buffer;
  isProduction: boolean;
  corsOrigins: string[];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`invalid configuration:\n${issues}`);
  }
  const config = parsed.data;

  const keyRing = createKeyRing(
    config.DATA_ENCRYPTION_KEYS.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    config.BLIND_INDEX_KEY,
  );

  const isProduction = config.NODE_ENV === 'production';

  if (isProduction) {
    if (config.PUBLIC_BASE_URL.startsWith('http://')) {
      throw new Error('PUBLIC_BASE_URL must be https in production');
    }
    if (config.ENABLE_DOCS) {
      // The docs UI describes every endpoint including the issuer surface.
      // Serving it publicly is free reconnaissance.
      throw new Error('ENABLE_DOCS must be false in production');
    }
  }

  return {
    ...config,
    keyRing,
    sessionSecret: Buffer.from(config.SESSION_SECRET, 'base64'),
    isProduction,
    corsOrigins: [config.CONSOLE_ORIGIN, config.VERIFY_ORIGIN, config.WALLET_ORIGIN],
  };
}

/** The `iss` value for an organisation, derived from the public base URL. */
export function issuerUrlFor(baseUrl: string, slug: string): string {
  return `${baseUrl.replace(/\/$/, '')}/issuers/${slug}`;
}

/** The published URL of a status list. PLAN §9. */
export function statusListUrlFor(baseUrl: string, slug: string, listId: number): string {
  return `${baseUrl.replace(/\/$/, '')}/v1/status/${slug}/${listId}`;
}
