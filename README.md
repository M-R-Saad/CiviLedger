# CiviLedger

Academic credential verification for Bangladesh. An employer scans a QR and
knows in under two seconds whether a degree is real, who awarded it, and how
rigorously the institution checked before signing. The consortium ledger
underneath is the reason that answer can be trusted; no user ever sees it.

Read [PLAN.html](PLAN.html) before making architectural decisions, particularly
§7 (architecture), §25 (hard invariants) and §26 (non-goals).

---

## What is here

```text
contracts/          Foundry. Five registries, no tokens, no value transfer
packages/
  credential/       SD-JWT VC issue, present, verify. Pure, no I/O
  status-list/      W3C Bitstring Status List. Pure
  verifier/         The public verification library (MIT)
  chain/            viem clients, typed contract bindings, Merkle
  ui/               Design tokens and the shared component vocabulary
services/
  api/              Fastify. Issuance, verification, wallet, registry
  anchor-worker/    Drains the ledger outbox; nightly and weekly anchors
apps/
  console/          Issuer console for registrars
  verify/           Public verification page, no authentication
  wallet/           Graduate PWA
infra/              Besu IBFT devnet, compose stack, genesis
docs/               Verification spec, threat model, decisions
```

## Running it

**Prerequisites:** Docker, Node 22+, and [pnpm](https://pnpm.io/installation)
(`npm install -g pnpm` or `corepack enable`).

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp infra/.env.example infra/.env
```

The example file ships usable devnet defaults. For anything beyond local
development, generate fresh values for `DATA_ENCRYPTION_KEYS`,
`BLIND_INDEX_KEY` and `SESSION_SECRET`.

### 3. Start the stack

```bash
docker compose -f infra/docker-compose.yml up -d
```

This brings up **everything**: four Besu IBFT validators, Postgres, deploys the
contracts automatically, starts the API on port 4000 and the anchor worker.
Wait until all services are healthy:

```bash
docker compose -f infra/docker-compose.yml ps   # all should show "healthy"
```

### 4. Migrate and seed

```bash
pnpm --filter @civiledger/api prisma:migrate
pnpm --filter @civiledger/api seed
```

The seed prints the demo accounts (emails + passwords) and a verifier API key.
Every person in it is invented: PLAN §18 is explicit that the prototype runs on
synthetic data, and the API refuses an import not marked synthetic unless
`ALLOW_REAL_PERSONAL_DATA` is set, which needs a signed DPA, in-country hosting
and a completed DPIA first.

### 5. Start the frontends

Open three terminals:

```bash
pnpm --filter @civiledger/console dev    # Issuer console  → http://localhost:5173
pnpm --filter @civiledger/verify dev     # Verification    → http://localhost:5174
pnpm --filter @civiledger/wallet dev     # Graduate wallet → http://localhost:5175
```

### Without Docker

Any EVM node and any Postgres 16 will do:

```bash
anvil --port 8545 --chain-id 1337
forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 \
  --broadcast --sig "run(address,bytes32)" $ADMIN $ADMIN_ORG_ID --private-key $KEY
```

Point `DATABASE_URL` at your Postgres instance, then run steps 4 and 5 above.

## Testing

```bash
pnpm test                    # every package
forge test                   # contracts, including fuzz
forge coverage --report summary
```

Integration tests need a real database and a real chain, and skip without them:

```bash
CIVILEDGER_TEST_RPC_URL=http://127.0.0.1:8545 \
CIVILEDGER_TEST_DATABASE_URL=postgresql://…/civiledger_test \
pnpm --filter @civiledger/api test
```

They run against real infrastructure on purpose. The things most likely to
break here are a status list whose hash does not match the chain, a Merkle
proof the contract rejects, and an encrypted column that will not decrypt.
A mocked test passes all three.

## The three rules that shape everything

**Nothing on chain is personal data.** No names, no dates of birth, no grades,
no unsalted hash of any of those, no stable per-citizen identifier, and no
individual verification events. Every anchored digest is salted with a secret
held only in the database, so destroying that row makes the on-chain digest an
unlinkable random value. That is how erasure works under the PDPA.

**Keys resolve by signing time, not by now.** `IssuerRegistry.keyAt(orgId, ts)`
takes the credential's `iat`. A rotation must never invalidate history, and a
compromised key is revoked with an effective instant so the credentials signed
before it survive.

**Verification must work without us.** The credential, a signed registry
snapshot and a status list are sufficient. If a check needs our API, the design
is wrong. [`packages/verifier`](packages/verifier) is MIT licensed and has no
network or chain client of its own, so anyone can run it against their own node.

## Documentation

| Document | What it is for |
| --- | --- |
| [PLAN.html](PLAN.html) | The binding architecture and business plan |
| [docs/verification-spec.md](docs/verification-spec.md) | How to verify without us |
| [docs/threat-model.md](docs/threat-model.md) | Threats, controls, and the gaps |
| [docs/decisions/](docs/decisions) | One ADR per decision that extends the plan |
| [docs/product.md](docs/product.md) / [docs/design.md](docs/design.md) | Users, voice, and the visual system |

## Status

Phase 1 of PLAN §23. The system runs end to end on synthetic data: import,
review, four-eyes approval, signing, anchoring, sharing with a claim scope,
verification, revocation inside a minute, and a consent receipt the graduate
can read.

Not built, and deliberately listed rather than implied: SMS and email delivery
of enrolment invites, a KMS-backed signer for a real institution, anomaly
detection on issuance patterns, and an independent security review. The
threshold for governed actions is 1 until a second organisation runs a node,
and [infra/README.md](infra/README.md) says so plainly rather than calling four
validators on one laptop a consortium.
