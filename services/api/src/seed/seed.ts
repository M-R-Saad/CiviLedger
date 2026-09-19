/**
 * Devnet seed — synthetic data only.
 *
 * Brings up a working consortium: one issuing university admitted through
 * governance, its signing key registered on chain, staff accounts, a verifier
 * with an API key, and a graduate with a wallet login.
 *
 * Every person in here is invented. PLAN §18 is explicit: the prototype runs on
 * synthetic data — generate it, do not borrow it. This script refuses to run
 * against a deployment cleared for real personal data, because seeding test
 * accounts into one would be the fastest possible way to create a breach.
 */

import { PrismaClient } from '@prisma/client';
import { encodeFunctionData, type Hex } from 'viem';
import {
  accountFromPrivateKey,
  createLedgerPublicClient,
  createLedgerWalletClient,
  governanceAbi,
  issuerRegistryAbi,
  orgIdOf,
} from '@civiledger/chain';
import { keccak256, stringToHex } from 'viem';
import { generateEs256KeyPair, thumbprintToBytes32 } from '@civiledger/credential';
import { DEFAULT_LIST_SIZE } from '@civiledger/status-list';
import { loadConfig, issuerUrlFor } from '../lib/config.js';
import { buildContext } from '../lib/context.js';
import { encrypt, encryptJson } from '../lib/crypto.js';
import { createUser, hashPassword } from '../services/auth.service.js';
import { generateApiKey } from '../services/auth.service.js';
import { blindIndex } from '../lib/crypto.js';

const DEMO_PASSWORD = 'civiledger-devnet-2026';

const ORGANISATION = {
  slug: 'uiu',
  legalName: 'United International University',
  nameBn: 'ইউনাইটেড ইন্টারন্যাশনাল ইউনিভার্সিটি',
  didWeb: 'did:web:localhost%3A4000:issuers:uiu',
  accreditation: 'UGC_RECOGNIZED' as const,
  ugcRegNo: 'UGC/PU/2003/47',
};

async function main(): Promise<void> {
  const config = loadConfig();

  if (config.ALLOW_REAL_PERSONAL_DATA || config.isProduction) {
    throw new Error(
      'refusing to seed synthetic accounts into a deployment cleared for real personal data',
    );
  }

  const prisma = new PrismaClient({ datasourceUrl: config.DATABASE_URL });
  const ctx = buildContext({ config, prisma });

  const anchorKey = process.env['ANCHOR_PRIVATE_KEY'];
  if (!anchorKey) {
    throw new Error('ANCHOR_PRIVATE_KEY is required to register the issuer on chain');
  }
  const account = accountFromPrivateKey(anchorKey);
  const chainConfig = { rpcUrl: config.CHAIN_RPC_URL, chainId: config.CHAIN_ID };
  const publicClient = createLedgerPublicClient(chainConfig);
  const wallet = createLedgerWalletClient(chainConfig, account);

  console.log(`seeding against chain ${config.CHAIN_ID} as ${account.address}`);

  // --- the anchor worker's role ---------------------------------------------
  // Without ORACLE_ROLE the worker can anchor batches and status lists (those
  // are authorised per-issuer) but cannot record the nightly audit root or the
  // public checkpoint, which fail with NotOracle().
  const oracleRole = keccak256(stringToHex('civiledger.role.oracle'));
  const alreadyOracle = await publicClient.readContract({
    address: ctx.addresses.Governance,
    abi: governanceAbi,
    functionName: 'hasRole',
    args: [oracleRole, account.address],
  });
  if (!alreadyOracle) {
    await governCall(
      ctx.addresses.Governance,
      encodeFunctionData({
        abi: governanceAbi,
        functionName: 'grantOperationalRole',
        args: [oracleRole, account.address],
      }),
    );
    console.log(`granted ORACLE_ROLE to ${account.address}`);
  }

  // --- the issuing university ----------------------------------------------
  const orgId = orgIdOf(ORGANISATION.slug);
  const issuerUrl = issuerUrlFor(config.PUBLIC_BASE_URL, ORGANISATION.slug);
  const keys = await generateEs256KeyPair();
  const thumbprintHex = thumbprintToBytes32(keys.thumbprint);

  const organization = await prisma.organization.upsert({
    where: { slug: ORGANISATION.slug },
    update: {},
    create: {
      slug: ORGANISATION.slug,
      orgIdHash: orgId,
      legalName: ORGANISATION.legalName,
      nameBn: ORGANISATION.nameBn,
      issuerUrl,
      didWeb: ORGANISATION.didWeb,
      accreditation: ORGANISATION.accreditation,
      ugcRegNo: ORGANISATION.ugcRegNo,
      status: 'ACTIVE',
      revenueShareBps: 3000,
    },
  });

  // Any live key, not specifically epoch 0: after a rotation the current key
  // sits at a higher epoch, and keying off 0 would rotate again on every run.
  const existingKey = await prisma.issuerKey.findFirst({
    where: { organizationId: organization.id, validUntil: null, revokedReason: null },
    orderBy: { epoch: 'desc' },
  });

  if (!existingKey) {
    // The ledger outlives the database on a devnet: `anvil` keeps state while
    // the database is dropped and recreated. If the org is already registered
    // on chain, its old signing key is gone with the old database, so the
    // honest move is to rotate to the key we just generated rather than leave
    // the two disagreeing, which would fail every verification with
    // "issuer key not found".
    const onChain = await publicClient.readContract({
      address: ctx.addresses.IssuerRegistry,
      abi: issuerRegistryAbi,
      functionName: 'getIssuer',
      args: [orgId],
    });

    const epoch = onChain.exists
      ? Number(
          await publicClient.readContract({
            address: ctx.addresses.IssuerRegistry,
            abi: issuerRegistryAbi,
            functionName: 'epochCount',
            args: [orgId],
          }),
        )
      : 0;

    await prisma.issuerKey.create({
      data: {
        organizationId: organization.id,
        epoch,
        jwkThumbprint: thumbprintHex,
        publicJwk: keys.publicJwk as never,
        // The development signer stores the private JWK envelope-encrypted and
        // refuses to load outside a synthetic deployment. A production issuer
        // key is created non-exportable in the institution's own KMS.
        kmsKeyRef: `localdev:${Buffer.from(encryptJson(config.keyRing, keys.privateJwk)).toString('base64')}`,
        validFrom: new Date(),
      },
    });

    if (onChain.exists) {
      // `validFrom` must strictly exceed the current epoch's start, so the new
      // key takes effect from the next second. Credentials signed before that
      // instant still resolve to the old epoch, which is the point of keyAt().
      const nextSecond = BigInt(Math.floor(Date.now() / 1000) + 1);
      await govern(
        encodeFunctionData({
          abi: issuerRegistryAbi,
          functionName: 'rotateKey',
          args: [orgId, thumbprintHex as Hex, nextSecond],
        }),
      );
      console.log(
        `rotated ${ORGANISATION.slug} to key ${thumbprintHex} (epoch ${epoch}); the previous epoch stays resolvable`,
      );
      // Do not sign anything until the new epoch is actually in force.
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } else {
      await govern(
        encodeFunctionData({
          abi: issuerRegistryAbi,
          functionName: 'registerIssuer',
          args: [orgId, ORGANISATION.didWeb, 3, thumbprintHex as Hex, 0n],
        }),
      );
      console.log(`registered ${ORGANISATION.slug} on chain with key ${thumbprintHex}`);
    }

    // Governance actions are content-addressed, so re-executing an identical
    // payload reverts with AlreadyExecuted. Check before proposing.
    const alreadyOperator = await publicClient.readContract({
      address: ctx.addresses.IssuerRegistry,
      abi: issuerRegistryAbi,
      functionName: 'isOperator',
      args: [orgId, account.address],
    });
    if (!alreadyOperator) {
      await govern(
        encodeFunctionData({
          abi: issuerRegistryAbi,
          functionName: 'setOperator',
          args: [orgId, account.address, true],
        }),
      );
    }
  } else {
    console.log(`${ORGANISATION.slug} already has a signing key; leaving the chain alone`);
  }

  // --- a status list to allocate into --------------------------------------
  await prisma.statusList.upsert({
    where: {
      organizationId_listId_purpose: {
        organizationId: organization.id,
        listId: 1,
        purpose: 'REVOCATION',
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      listId: 1,
      purpose: 'REVOCATION',
      size: DEFAULT_LIST_SIZE,
      bitstring: Buffer.alloc(DEFAULT_LIST_SIZE / 8),
      version: 0,
    },
  });

  // --- staff ----------------------------------------------------------------
  // Two accounts on purpose: four-eyes approval means the person who uploads a
  // batch cannot be the person who approves it.
  const staff = [
    { email: 'registrar@uiu.test', name: 'Registrar (demo)', role: 'REGISTRAR' as const },
    {
      email: 'controller@uiu.test',
      name: 'Exam Controller (demo)',
      role: 'EXAM_CONTROLLER' as const,
    },
    { email: 'oversight@civiledger.test', name: 'Oversight (demo)', role: 'OVERSIGHT' as const },
  ];

  for (const person of staff) {
    const index = blindIndex(config.keyRing, person.email);
    const exists = await prisma.user.findUnique({ where: { emailIndex: index } });
    if (exists) continue;
    await createUser(ctx, {
      email: person.email,
      password: DEMO_PASSWORD,
      displayName: person.name,
      role: person.role,
      ...(person.role === 'OVERSIGHT' ? {} : { organizationId: organization.id }),
    });
  }

  // --- a verifier -----------------------------------------------------------
  let apiKey: string | undefined;
  const existingVerifier = await prisma.verifier.findFirst({
    where: { orgName: 'Meghna Recruitment (demo)' },
  });

  if (!existingVerifier) {
    const generated = generateApiKey();
    apiKey = generated.key;
    const verifier = await prisma.verifier.create({
      data: {
        orgName: 'Meghna Recruitment (demo)',
        contactEmailEnc: encrypt(config.keyRing, 'hiring@meghna.test'),
        plan: 'METERED',
        apiKeyHash: generated.hash,
        apiKeyPrefix: generated.prefix,
        monthlyQuota: 500,
        kybStatus: 'VERIFIED',
      },
    });
    await createUser(ctx, {
      email: 'verifier@meghna.test',
      password: DEMO_PASSWORD,
      displayName: 'Hiring Manager (demo)',
      role: 'VERIFIER_STAFF',
      verifierId: verifier.id,
    });
  }

  // --- a graduate with a wallet login --------------------------------------
  const graduateEmail = 'ahnaf@graduate.test';
  const graduateIndex = blindIndex(config.keyRing, graduateEmail);
  const existingSubject = await prisma.subject.findUnique({ where: { emailIndex: graduateIndex } });
  if (!existingSubject) {
    await prisma.subject.create({
      data: {
        displayNameEnc: encrypt(config.keyRing, 'Ahnaf Rahman'),
        dobEnc: encrypt(config.keyRing, '2001-04-17'),
        emailEnc: encrypt(config.keyRing, graduateEmail),
        emailIndex: graduateIndex,
        identityAssurance: 'AL2',
        passwordHash: await hashPassword(DEMO_PASSWORD),
      },
    });
  }

  console.log('\nseeded. synthetic accounts:');
  console.table([
    ...staff.map((s) => ({ who: s.role, email: s.email, password: DEMO_PASSWORD })),
    { who: 'VERIFIER_STAFF', email: 'verifier@meghna.test', password: DEMO_PASSWORD },
    { who: 'GRADUATE (wallet)', email: graduateEmail, password: DEMO_PASSWORD },
  ]);
  if (apiKey) {
    console.log(`\nverifier API key (shown once): ${apiKey}`);
  }
  console.log(`\nsample CSV: services/api/src/seed/sample-graduates.csv`);

  await prisma.$disconnect();

  /** Propose and execute a governed action against IssuerRegistry. */
  async function govern(payload: Hex): Promise<void> {
    await governCall(ctx.addresses.IssuerRegistry, payload);
  }

  /**
   * Propose and execute a governed action against any target.
   * Threshold is 1 on a fresh devnet, which PLAN §3 is explicit is not a
   * consortium; raising it is itself a governed action once nodes two and
   * three exist.
   */
  async function governCall(target: `0x${string}`, payload: Hex): Promise<void> {
    for (const functionName of ['proposeAction', 'executeAction'] as const) {
      const { request } = await publicClient.simulateContract({
        account,
        address: ctx.addresses.Governance,
        abi: governanceAbi,
        functionName,
        args: [target, payload],
        chain: wallet.chain,
      });
      const hash = await wallet.writeContract(request as never);
      await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    }
  }
}

main().catch((error: unknown) => {
  console.error('seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
