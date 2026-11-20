# CiviLedger

Read **PLAN.html §7 (architecture), §25 (hard invariants) and §26 (non-goals)**
before making architectural decisions. Do not duplicate its content here;
duplication causes drift.

When a decision extends or contradicts the plan, add an ADR under
`docs/decisions/` rather than changing PLAN.html silently.

## Conventions

- TypeScript strict everywhere. No `any` in `packages/`.
- Crypto and verification logic lives in `packages/`, never in a service or an app.
- Migrations are forward-only.
- Secrets come from the environment or a KMS. A private key in git is a rebuild.
- No user-facing English in the API or in `packages/`. Emit stable machine
  codes; `packages/ui/src/i18n.tsx` turns them into bilingual sentences.

## Before changing the ledger layer

`forge test` must pass, and `IssuerRegistry` and `StatusRegistry` must hold at
least 95% line coverage. `node contracts/script/compile-check.mjs` additionally
fails the build on token semantics or a `string` in an event parameter.
