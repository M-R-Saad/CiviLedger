# 0004. Three separate front ends, not one role-switched app

**Status:** accepted
**Supersedes:** the previous `docs/03_PROJECT_STRUCTURE.md`, which said "one
frontend app, not three"

## Context

The previous system shipped one React app with role-based routing and a shared
`AppShell`. Its own documentation predicted this change: "you can mention in
your report that production would split these into separate deployable apps."

PLAN §5.1 specifies three surfaces whose constraints genuinely differ.

## Decision

Three Vite apps over one shared design system
([`packages/ui`](../../packages/ui)):

| App | The constraint that forces separation |
|---|---|
| `apps/verify` | Public, unauthenticated, opens from a QR on a mid-range Android phone over a slow network. Must not ship a byte of console or wallet code |
| `apps/console` | Staff tooling, desk-bound, left rail, `noindex`, session in `sessionStorage` because office machines are shared |
| `apps/wallet` | Installable PWA, bottom tab bar, service worker, `localStorage` because a wallet that logs you out whenever a tab closes is not a wallet |

## Consequences

- The verification page ships roughly 17 KB of application code gzipped.
  Bundling it with the console's tables, forms and CSV handling would multiply
  that on the one surface where load time is the product.
- Three deploy targets instead of one, and one shared package to keep in step.
- The session model differs per surface deliberately, which a single app could
  not express without a per-role special case.
- `packages/ui` holds the only Button, the only Field, the only StatusPill and
  the only DataTable, so the split does not become three diverging design
  systems (PRODUCT.md principle 5).
