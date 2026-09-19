# 0005. Graduates claim credentials through a one-time institutional invite

**Status:** accepted
**Fills a gap in:** PLAN.html §5.3, which ends the issuance flow at "notify
graduates (SMS / email)" without specifying the mechanism

## Context

Issuance creates a `Subject` from the institution's record. That subject has no
login, so a graduate had no way to reach their own credential.

The gap surfaced by running the end-to-end flow rather than by reading the
plan: import, review, four-eyes approval, signing and anchoring all passed, and
then the wallet had nobody to sign in as.

## Decision

The institution mints a one-time enrolment token
(`POST /v1/issuer/credentials/:id/invite`) and delivers it out of band, through
a channel it already uses for that graduate. Redeeming it
(`POST /v1/auth/wallet/enrol`) attaches an email and password to the subject
that already holds the credentials, and signs them straight in.

Tokens are stored hashed, single-use, expire after 14 days, and only one may be
live per subject at a time.

## Consequences

- The out-of-band delivery *is* the identity check, and it is the
  institution's, not ours. We are not claiming to have verified who the person
  is; the credential's assurance level already records how rigorous the
  institution's own check was.
- This is also the loss-recovery path PLAN §12.2 asks for in week one:
  re-identify, re-invite, and redeeming revokes every existing session for that
  subject.
- A graduate who never enrols still holds a valid credential, and the
  institution can present it on their behalf. Enrolment gates the wallet, not
  the credential.
- Delivery itself is not built. The token is returned to the console for the
  institution to send; wiring an SMS or email provider is a pilot decision, and
  hard-coding one now would be guessing at which gateway the first university
  already pays for.
