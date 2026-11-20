# CiviLedger verification specification

**Version 1.0 · Status: draft for the pilot**

This document describes how to verify a CiviLedger credential without asking
CiviLedger. It is published because a verification that depends on our uptime
and our honesty is not a verification (PLAN.html §16).

Everything here is implementable from public data: the credential itself, the
signed issuer-registry snapshot, and the status list. The reference
implementation is [`@civiledger/verifier`](../packages/verifier), MIT licensed.

---

## 1. What a credential is

An SD-JWT VC, as defined by
[draft-ietf-oauth-sd-jwt-vc](https://datatracker.ietf.org/doc/draft-ietf-oauth-sd-jwt-vc/)
over [draft-ietf-oauth-selective-disclosure-jwt](https://datatracker.ietf.org/doc/draft-ietf-oauth-selective-disclosure-jwt/).

```
<issuer-signed-jwt>~<disclosure>~<disclosure>~…~<key-binding-jwt>?
```

- The issuer-signed JWT is `ES256` (P-256) with `typ` of `dc+sd-jwt`.
  `vc+sd-jwt` from earlier drafts is accepted for backwards compatibility.
- Each disclosure is `base64url(JSON([salt, claimName, claimValue]))`.
- `_sd` holds `base64url(SHA-256(ASCII(disclosure)))` for each disclosable
  claim, plus decoy digests so the number of withheld claims cannot be counted.
- `_sd_alg` is always `sha-256`.

### Always-visible claims

These are deliberately **not** selectively disclosable. A verifier must never
be able to receive a credential without also seeing how rigorously it was
checked.

| Claim | Meaning |
|---|---|
| `iss` | Issuer identifier; an https URL serving issuer metadata |
| `vct` | Credential type. Frozen and versioned; see §6 |
| `iat` | Issuance time. **This is what key resolution uses** |
| `exp` | Expiry, or `null` for types that do not expire |
| `issuer_name` | The institution's legal name |
| `accreditation` | `UGC_RECOGNIZED`, `BOARD`, `PROFESSIONAL_BODY`, `SELF_ASSERTED` |
| `assurance_level` | `AL1`–`AL3+`; see §5 |
| `evidence` | How the record was checked, by which role, on what date |
| `cnf` | Holder binding public key, when one is bound |
| `status` | Status list index and URI |

---

## 2. The six checks

A verifier performs all six. Checks 1–4 and 6 work entirely offline against a
cached registry snapshot and a cached status list.

### 1. Is the issuer in the registry, and was its key valid **at signing time**?

Resolve `iss` to an `orgId`, then call:

```solidity
IssuerRegistry.keyAt(bytes32 orgId, uint64 timestamp)
  returns (bytes32 thumbprint, bool valid, bytes32 reason)
```

Pass the credential's `iat`, **never the current time**. A key rotated or
revoked today must not invalidate what it signed last year. A key revoked with
an effective timestamp splits exactly at that instant: signatures before it
remain valid, signatures after it do not.

`thumbprint` is the RFC 7638 thumbprint of the public JWK, as 32 bytes. The
JOSE form is the same digest in base64url.

Equivalent offline: read the same fields from the registry snapshot (§4).

### 2. Does the signature cover the disclosed claims?

1. Verify the issuer-signed JWT with the resolved public key, `ES256` only.
2. For each presented disclosure, compute its digest and require it to appear
   in `_sd`. A disclosure that does not match one the issuer signed means a
   claim was appended after issuance: **reject**.
3. Reject a repeated claim name.
4. Check `nbf` and `exp` with a clock skew of at most 60 seconds.

### 3. Is the status bit set?

Read `status.status_list.idx` and `status.status_list.uri`, fetch the list, and
read that bit. `1` means set: revoked on a revocation-purpose list, suspended
on a suspension-purpose list.

A credential with no `status` claim cannot be revoked. Report that as a
property of the credential, not as a check that passed.

### 4. Does the status list match the chain?

```solidity
StatusRegistry.getStatusList(bytes32 orgId, uint32 listId)
  returns (bytes32 listHash, string uri, uint64 version, uint64 updatedAt)
```

- `listHash` is `SHA-256` over the **`encodedList` string as served**, not over
  a re-compression of the bits. Compare byte for byte.
- If the served version is **lower** than the chain's: reject. That is the
  rollback attack, whatever the signature says.
- If the served version is **higher** than the chain's: the list is signed and
  strictly newer, so honour the bit, but report the anchor as pending rather
  than as matched. A revocation published to a CDN seconds before its anchoring
  transaction confirms is the normal case, and refusing it would suppress the
  revocation.
- Equal version with a different hash: reject.

**Rollback floor.** A verifier that has accepted version *n* for a list must
reject any later fetch below *n*, and must persist that floor. Without it,
whoever controls the CDN can suppress a revocation by serving an older signed
list. Implement it once in the shared library, not in each client.

### 5. Is the anchor inclusion proof valid?

Optional; only meaningful when the presentation carries a proof.

```solidity
AnchorRegistry.verifyInclusion(bytes32 batchId, bytes32 leaf, bytes32[] proof)
```

Leaves are `keccak256(salt ‖ sdJwtDigest)` with sorted-pair hashing. The salt
never leaves the issuer's database, so no observer can reconstruct a leaf or
test a guess against one. This check adds proof of existence at a point in
time; it does not affect whether the credential is authentic.

### 6. Is holder binding satisfied?

When a key-binding JWT is present:

- `typ` is `kb+jwt`, `alg` is `ES256`.
- Verify against `cnf.jwk` from the credential.
- `sd_hash` must equal the digest of the presentation up to and including the
  final `~`. This binds the KB-JWT to exactly this set of disclosures, so a
  captured one cannot be replayed against a wider claim scope.
- `aud` must match the verifier's identifier and `nonce` the challenge issued.
- Reject a KB-JWT older than five minutes.

A signature proves a credential is authentic. It does not prove the person
presenting it is the subject. Without this check, holder binding is
`not_presented`, and the result must say so rather than implying possession.

---

## 3. Deciding the result

| Result | When |
|---|---|
| `valid` | All applicable checks passed |
| `revoked` | Status bit set on a revocation list |
| `suspended` | Status bit set on a suspension list |
| `expired` | Past `exp` |
| `invalid` | Any check failed |
| `unknown_issuer` | `iss` is not in the registry |
| `undetermined` | A check could not be completed |

**Fail closed.** `undetermined` is not a pass. "We could not reach the chain"
must never render as "this degree is real". Any check that could not be
completed downgrades the result.

A cached result is always labelled as cached, with its snapshot date visible.
Never present a cached result as a live one.

---

## 4. The registry snapshot

`GET /v1/registry/snapshot` returns a signed, cacheable document listing every
issuer, its accreditation and status, and its full key history with validity
windows. It carries the chain id, the block height it was taken at, the
registry addresses, and the latest public checkpoint.

A verifier that caches this plus the relevant status lists can perform checks
1–4 and 6 with no network access at all, which is what makes verification
possible in a district office on an intermittent connection.

The snapshot's `digest` is `SHA-256` over its canonical JSON, excluding the
digest field itself.

---

## 5. Assurance levels

Not every credential was checked the same way, and a verifier must be able to
tell the difference. Displaying an AL1 as though it were an AL3 would make the
displaying system the fraud.

| Level | How the subject and record were checked |
|---|---|
| `AL1` | Document scan matched by name against the institution's record |
| `AL2` | Institution staff confirmed the record against their system |
| `AL3` | Issued from the system of record at graduation |
| `AL3+` | AL3 plus a verified identity check at wallet enrolment |

`AL0` exists as a floor value in code and must never appear on a published
credential.

The `evidence` block names the method, the source system, the date, and the
role of the person who checked. It is always visible.

---

## 6. Credential types

Every `vct` is versioned and **immutable once published**. A schema change
means a new `vct`, never an edit in place, because verifiers abroad pin against
these identifiers.

| vct | Expires | Suspendable |
|---|---|---|
| `bd.civiledger.academic.degree.v1` | no | no |
| `bd.civiledger.academic.transcript.v1` | no | no |
| `bd.civiledger.academic.enrolment.v1` | yes | yes |
| `bd.civiledger.professional.licence.v1` | yes | yes |

`GET /v1/credential-types` returns the frozen definitions, including each
claim's type, whether it is required, and whether it is sensitive.

---

## 7. What is never on chain

Stated so an auditor can check the claim rather than take it on trust:

- No names, national ID numbers, dates of birth, addresses, contact details,
  photographs or biometrics.
- No grades, transcripts or claim values of any kind.
- No unsalted hash of any of the above. A hash of a small-domain value is a
  lookup table away from being the value.
- No stable per-citizen identifier. Nothing lets an observer link two
  credentials to one person.
- No individual verification events. Consent receipts are aggregated into a
  daily Merkle root; the verification graph stays off chain.

Every anchored digest is salted with a per-credential secret held only in the
issuer's database. Destroying that record renders the on-chain digest an
unlinkable random value, which is how erasure is implemented.

---

## 8. Reference implementation

```ts
import { verifyPresentation } from '@civiledger/verifier';

const report = await verifyPresentation({
  sdJwt: presentation,
  issuers: myIssuerDirectory,   // live chain, or a cached snapshot
  statusLists: myStatusSource,
  versionFloor: myPersistentFloor,
  now: Math.floor(Date.now() / 1000),
});
```

The library depends only on `@civiledger/credential` and
`@civiledger/status-list`. It has no network client and no chain client of its
own: you supply those, which is what makes it possible to verify against your
own node rather than ours.

---

## 9. Conformance

A conforming verifier must:

1. Resolve issuer keys by the credential's `iat`, never by the current time.
2. Reject a disclosure whose digest is not in `_sd`.
3. Persist a per-list version floor and reject any regression.
4. Treat an incomplete check as `undetermined`, never as `valid`.
5. Surface the assurance level and evidence in every result.
6. Label a cached result as cached, with its freshness window.

The test vectors in
[`packages/verifier/src/verify.test.ts`](../packages/verifier/src/verify.test.ts)
are written as the threat model: each case is an attack that must fail or a
legitimate case that must survive. An implementation that passes all of them
satisfies this specification.
