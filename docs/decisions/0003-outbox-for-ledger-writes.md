# 0003. Ledger writes go through a transactional outbox

**Status:** accepted
**Extends:** PLAN.html §7.2

## Context

The system this replaces anchored on chain first and wrote the database second.
Its own comment described the consequence:

```js
// The anchor is already on-chain; log enough to reconcile it later.
console.error(`DB write failed after on-chain anchor ${anchorId}`, dbErr);
```

There was no reconciliation job, no retry and no outbox, so a database failure
permanently orphaned an on-chain anchor and the only recovery was a human
noticing a log line. Three other paths swallowed chain failures entirely with
`console.warn(... "non-fatal")`, meaning the database recorded success while
the chain held no record. The audit trail was therefore not trustworthy.

## Decision

Every ledger write is enqueued in `outbox_entries` **inside the same database
transaction that produces it**. The anchor worker drains that queue.

Retrying is safe because every registry write is either idempotent
(`anchorBatch` derives its id from its content and reverts on a repeat) or
version-guarded (`publishStatusList` refuses a non-increasing version).

## Consequences

- The chain write cannot happen unless the rows are committed, so an anchor is
  never orphaned and a row never references a transaction that does not exist.
- A chain outage delays external provability but never loses a revocation. The
  status list is served immediately and reported as pending-anchor, so a
  revoked credential never reads as valid while the transaction is in flight.
- Anchoring falling behind is invisible to users and therefore has to be
  visible to operators: `outboxHealth` drives a warning when the queue ages.
- A status-list publish that a newer version has already superseded on chain is
  closed out as done rather than retried, because re-sending it would be asking
  the chain to roll back. This case was found by running the worker against a
  real chain, not by reasoning about it.
- The API holds no chain-writing key at all. Only the worker does, and that key
  cannot sign a credential.
