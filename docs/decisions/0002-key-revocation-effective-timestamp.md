# 0002. `revokeKey` takes an effective timestamp

**Status:** accepted
**Extends:** PLAN.html §11

## Context

PLAN §11 sketches `revokeKey(bytes32 orgId, uint16 epoch, bytes32 reason)`.
PLAN §12.1 separately requires that a compromised key is revoked with a reason
*and an effective timestamp*, so that credentials signed before the compromise
window remain valid, which is the stated reason `keyAt()` takes a timestamp at
all.

The sketched signature cannot express §12.1. Without an effective instant, a
revocation either invalidates the whole epoch, destroying every credential the
key legitimately signed, or invalidates nothing before now, which leaves the
entire compromise window valid.

## Decision

```solidity
function revokeKey(bytes32 orgId, uint16 epoch, bytes32 reason, uint64 effectiveFrom)
```

`effectiveFrom` of 0 means "now". A revocation may bring an epoch's end forward
but never extend it, so it cannot retroactively re-validate signatures made
with a key that was already superseded by a rotation.

## Consequences

- A stolen key is revoked from the moment of compromise rather than the moment
  of discovery, so the forgeries fall outside the window and the genuine
  credentials stay inside it.
- `keyAt` returns the thumbprint even when `valid` is false, letting a verifier
  distinguish "signed with a key we know, after it was revoked" from "signed
  with a key we have never seen". Those warrant different responses and
  different copy.
- Tested at the exact boundary, and by fuzzing, in
  `testFuzz_revokedEpochSplitsAtExactlyTheEffectiveInstant`.
