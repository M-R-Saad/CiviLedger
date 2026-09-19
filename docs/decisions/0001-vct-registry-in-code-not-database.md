# 0001. The credential-type registry lives in code, not in a table

**Status:** accepted
**Extends:** PLAN.html §14, which lists a `credential_types` table

## Context

PLAN §14 lists `credential_types(vct, json_schema, disclosable_claims, version,
frozen_at)` in the data model. PLAN §8 separately states the schema rule: every
vct is versioned and immutable once published, and a schema change means a new
vct plus a migration note in the repo, never an edit in place.

These pull against each other. A database table is editable by anyone with a
connection. The previous system's equivalent table carried a `json_schema`
column that nothing ever validated against, which is how it came to hold an
informal `{fields: {name: "string"}}` shape that was pure decoration while
`issueCredential` accepted `z.record(z.unknown())`.

## Decision

The frozen registry lives in
[`packages/credential/src/vct.ts`](../../packages/credential/src/vct.ts) as
`as const` TypeScript, and is served read-only at `GET /v1/credential-types`.
There is no `credential_types` table.

## Consequences

- A schema change is a code change: it goes through review, shows up in
  `git blame`, and cannot be applied to production with an UPDATE.
- `validateClaims` is the single enforcement point, used by the CSV importer
  and again by `issueCredential`, so an unvalidated claim set cannot be signed.
- The pure package carries the registry, so the open-source verifier knows the
  claim definitions without a network call and can compute what was withheld.
- Adding a credential type requires a deploy. That friction is the point.
