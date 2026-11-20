/**
 * Integration-test harness.
 *
 * These tests run against a real Postgres and a real EVM node, not mocks. The
 * things most likely to break in this system — a status list whose hash does
 * not match the chain, a Merkle proof the contract rejects, an encrypted column
 * that will not decrypt — are precisely the things a mocked test would pass.
 */

import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { encodeFunctionData, type Hex } from 'viem';
import {
  accountFromPrivateKey,
  createLedgerPublicClient,
  createLedgerWalletClient,
  governanceAbi,
  issuerRegistryAbi,
  orgIdOf,
  LedgerWriter,
  parseContractAddresses,
} from '@civiledger/chain';
import { generateEs256KeyPair, thumbprintToBytes32 } from '@civiledger/credential';
import { DEFAULT_LIST_SIZE } from '@civiledger/status-list';
import { buildApp, type App } from '../app.js';
import { loadConfig, issuerUrlFor, type AppConfig } from '../lib/config.js';
import { buildContext, type AppContext } from '../lib/context.js';
import { encrypt, encryptJson, blindIndex } from '../lib/crypto.js';
import { createUser, generateApiKey, hashPassword } from '../services/auth.service.js';

export const TEST_RPC_URL = process.env['CIVILEDGER_TEST_RPC_URL'] ?? '';
export const TEST_DATABASE_URL = process.env['CIVILEDGER_TEST_DATABASE_URL'] ?? '';
export const TEST_CHAIN_ID = Number(process.env['CIVILEDGER_TEST_CHAIN_ID'] ?? 1337);
/** Anvil's first account — a published test key, never used anywhere real. */
export const TEST_ANCHOR_KEY =
  process.env['CIVILEDGER_TEST_KEY'] ??
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

export const integrationAvailable = TEST_RPC_URL !== '' && TEST_DATABASE_URL !== '';

export const TEST_PASSWORD = 'integration-test-password-2026';

export interface Harness {
  app: App;
  ctx: AppContext;
  prisma: PrismaClient;
  config: AppConfig;
  organizationId: string;
  orgSlug: string;
  issuerUrl: string;
  writer: LedgerWriter;
  users: {
    registrarToken: string;
    controllerToken: string;
    verifierApiKey: string;
    graduateToken: string;
    graduateSubjectId: string;
  };
  /** Advance the harness clock, in seconds. */
  advance(seconds: number): void;
  close(): Promise<void>;
}

let clockOffset = 0;

export async function createHarness(): Promise<Harness> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    CHAIN_RPC_URL: TEST_RPC_URL,
    CHAIN_ID: String(TEST_CHAIN_ID),
    DEPLOYMENTS_FILE: resolve(
      import.meta.dirname,
      `../../../../contracts/deployments/${TEST_CHAIN_ID}.json`,
    ),
    DATA_ENCRYPTION_KEYS: `1:${randomBytes(32).toString('base64')}`,
    BLIND_INDEX_KEY: randomBytes(32).toString('base64'),
    SESSION_SECRET: randomBytes(32).toString('base64'),
    PUBLIC_BASE_URL: 'http://localhost:4000',
    ALLOW_REAL_PERSONAL_DATA: 'false',
    LOG_LEVEL: 'silent',
  };

  const config = loadConfig(env);
  const prisma = new PrismaClient({ datasourceUrl: config.DATABASE_URL });
  clockOffset = 0;
  const ctx = buildContext({
    config,
    prisma,
    now: () => Math.floor(Date.now() / 1000) + clockOffset,
  });

  await resetDatabase(prisma);

  // A fresh orgId per run, so the suite is re-runnable against a chain that
  // already holds state from earlier runs.
  const orgSlug = `test-${randomBytes(4).toString('hex')}`;
  const orgId = orgIdOf(orgSlug);
  const issuerUrl = issuerUrlFor(config.PUBLIC_BASE_URL, orgSlug);

  const account = accountFromPrivateKey(TEST_ANCHOR_KEY);
  const chainConfig = { rpcUrl: TEST_RPC_URL, chainId: TEST_CHAIN_ID };
  const publicClient = createLedgerPublicClient(chainConfig);
  const wallet = createLedgerWalletClient(chainConfig, account);
  const addresses = parseContractAddresses(
    JSON.parse(readFileSync(env['DEPLOYMENTS_FILE']!, 'utf8')),
  );
  const writer = new LedgerWriter(publicClient, wallet, addresses);

  const govern = async (payload: Hex): Promise<void> => {
    for (const functionName of ['proposeAction', 'executeAction'] as const) {
      const { request } = await publicClient.simulateContract({
        account,
        address: addresses.Governance,
        abi: governanceAbi,
        functionName,
        args: [addresses.IssuerRegistry, payload],
        chain: wallet.chain,
      });
      const hash = await wallet.writeContract(request as never);
      await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    }
  };

  const keys = await generateEs256KeyPair();
  // The chain stores the thumbprint as bytes32; JOSE produces base64url. The
  // database holds the chain-facing form so the two can be compared directly.
  const thumbprintHex = thumbprintToBytes32(keys.thumbprint);

  const organization = await prisma.organization.create({
    data: {
      slug: orgSlug,
      orgIdHash: orgId,
      legalName: 'United International University',
      nameBn: 'ইউনাইটেড ইন্টারন্যাশনাল ইউনিভার্সিটি',
      issuerUrl,
      didWeb: `did:web:test:${orgSlug}`,
      accreditation: 'UGC_RECOGNIZED',
      status: 'ACTIVE',
    },
  });

  await prisma.issuerKey.create({
    data: {
      organizationId: organization.id,
      epoch: 0,
      jwkThumbprint: thumbprintHex,
      publicJwk: keys.publicJwk as never,
      kmsKeyRef: `localdev:${Buffer.from(encryptJson(config.keyRing, keys.privateJwk)).toString('base64')}`,
      validFrom: new Date(),
    },
  });

  await govern(
    encodeFunctionData({
      abi: issuerRegistryAbi,
      functionName: 'registerIssuer',
      args: [orgId, `did:web:test:${orgSlug}`, 3, thumbprintHex as Hex, 0n],
    }),
  );
  await govern(
    encodeFunctionData({
      abi: issuerRegistryAbi,
      functionName: 'setOperator',
      args: [orgId, account.address, true],
    }),
  );

  await prisma.statusList.create({
    data: {
      organizationId: organization.id,
      listId: 1,
      purpose: 'REVOCATION',
      size: DEFAULT_LIST_SIZE,
      bitstring: Buffer.alloc(DEFAULT_LIST_SIZE / 8),
      version: 0,
    },
  });

  await createUser(ctx, {
    email: 'registrar@test.local',
    password: TEST_PASSWORD,
    displayName: 'Registrar',
    role: 'REGISTRAR',
    organizationId: organization.id,
  });
  await createUser(ctx, {
    email: 'controller@test.local',
    password: TEST_PASSWORD,
    displayName: 'Exam Controller',
    role: 'EXAM_CONTROLLER',
    organizationId: organization.id,
  });

  const apiKey = generateApiKey();
  const verifier = await prisma.verifier.create({
    data: {
      orgName: 'Test Recruiter',
      contactEmailEnc: encrypt(config.keyRing, 'hiring@test.local'),
      plan: 'METERED',
      apiKeyHash: apiKey.hash,
      apiKeyPrefix: apiKey.prefix,
      monthlyQuota: 1000,
      kybStatus: 'VERIFIED',
    },
  });
  await createUser(ctx, {
    email: 'verifier@test.local',
    password: TEST_PASSWORD,
    displayName: 'Hiring Manager',
    role: 'VERIFIER_STAFF',
    verifierId: verifier.id,
  });

  const graduateEmail = 'graduate@test.local';
  const graduate = await prisma.subject.create({
    data: {
      displayNameEnc: encrypt(config.keyRing, 'Ahnaf Rahman'),
      emailEnc: encrypt(config.keyRing, graduateEmail),
      emailIndex: blindIndex(config.keyRing, graduateEmail),
      identityAssurance: 'AL2',
      passwordHash: await hashPassword(TEST_PASSWORD),
    },
  });

  const app = await buildApp(ctx);
  await app.ready();

  const login = async (email: string, path = '/v1/auth/login'): Promise<string> => {
    const response = await app.inject({
      method: 'POST',
      url: path,
      payload: { email, password: TEST_PASSWORD },
    });
    if (response.statusCode !== 200) {
      throw new Error(`login failed for ${email}: ${response.statusCode} ${response.body}`);
    }
    return response.json().token as string;
  };

  return {
    app,
    ctx,
    prisma,
    config,
    organizationId: organization.id,
    orgSlug,
    issuerUrl,
    writer,
    users: {
      registrarToken: await login('registrar@test.local'),
      controllerToken: await login('controller@test.local'),
      verifierApiKey: apiKey.key,
      graduateToken: await login(graduateEmail, '/v1/auth/wallet/login'),
      graduateSubjectId: graduate.id,
    },
    advance(seconds: number) {
      clockOffset += seconds;
    },
    async close() {
      await app.close();
      await prisma.$disconnect();
    },
  };
}

/** Truncate every table. Faster and more thorough than re-running migrations. */
async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/** Apply migrations to the test database. Run once before the suite. */
export function migrateTestDatabase(): void {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: resolve(import.meta.dirname, '../..'),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
    shell: true,
  });
}

export const SAMPLE_CSV = readFileSync(
  resolve(import.meta.dirname, '../seed/sample-graduates.csv'),
  'utf8',
);
