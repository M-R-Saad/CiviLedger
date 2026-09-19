# infra

Everything needed to bring the consortium up with one command. PLAN.html §7.1.

```
docker compose up -d          # four Besu validators, Postgres, API, worker
pnpm --filter @civiledger/api prisma:migrate
pnpm --filter @civiledger/api seed
```

## Why four validators

IBFT 2.0 tolerates `f` faulty validators with `3f + 1` total. Four is the
smallest network that survives losing one node, which is the smallest network
worth calling a consortium. Three would halt the chain the first time a node
was rebooted for patching.

The devnet runs all four locally. That is explicitly **not** a consortium, and
PLAN §3 is clear we do not claim otherwise: day one, node two goes to the
design-partner university and node three to an independent operator, and
`docs/node-operators.md` records who runs what.

## Why Besu and not a dev chain

The system this replaces ran a single Hardhat node whose state a droplet reboot
wiped, and called it a consortium ledger. Three properties matter here and none
of them exist on a dev chain:

- **Deterministic finality.** A sealed IBFT block is final. There is no reorg
  to wait out, so one confirmation is the truth and the anchor worker can
  report a transaction as landed the moment it is mined.
- **Permissioning.** Validators are known institutions, not anonymous miners.
- **Persistence.** State survives a restart, because "your degree stopped
  verifying because we rebooted a server" is not a recoverable position.

## Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | The whole devnet: chain, database, API, worker |
| `besu/genesis.json` | IBFT 2.0 genesis with the four validators enrolled |
| `besu/config.toml` | Shared node configuration |
| `besu/keys/` | Validator node keys. **Devnet only** — see below |
| `deploy/` | Production notes and the systemd units |

## The keys in this directory are public

`besu/keys/` holds the four validator node keys, and the deployer key in
`.env.example` is Anvil's first account. They are committed on purpose so the
devnet comes up with one command and every developer gets the same contract
addresses.

They are worthless and must stay that way. A production network generates its
own with `besu public-key export-address`, keeps each validator's key on its
own operator's machine, and never puts one in a repository. A private key in
git is a rebuild (PLAN §24).

## Gas

The genesis sets a zero base fee and grants the deployer a balance. These
contracts are registries: there is no value transfer anywhere, and charging an
institution gas to record a revocation would be a tax on doing the right thing.
Free gas on a permissioned chain is the correct trade because the permissioning,
not the price, is what keeps the chain from being spammed.
