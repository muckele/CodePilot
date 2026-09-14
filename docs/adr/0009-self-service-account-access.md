# ADR 0009 — Delivery-gated self-service account access

- Status: accepted for v0.1.1
- Date: 2026-09-13
- Supersedes: no earlier ADR; extends ADR 0008

## Context

The private-pilot boundary already preserves Argon2id password login and
operator-issued, single-use recovery links. Learners also need bounded
self-service recovery and a second way to sign in without converting CodeLift
to a fully passwordless product. Email delivery introduces a provider boundary,
credential-delivery ambiguity, account-enumeration risk, and new operator
secrets. It must not make the learning application or existing access paths
dependent on provider availability.

The approved v0.1.1 surface is deliberately narrow: globally accessible sign
out, **Forgot password**, and **Email me a sign-in code** using a six-digit code.
Password login remains the primary supported path. SMS, OAuth/social login,
open registration, and unrelated product work are excluded.

## Decision

### Runtime availability boundary

Production validates static email configuration at startup and fails closed if
`EMAIL_PROVIDER=resend` is incomplete, inconsistent, directly injected as a
plaintext environment secret, or otherwise unsafe. `EMAIL_PROVIDER=disabled`
is a valid production state.

After startup, a Resend runtime outage is isolated to the email operation.
Password login, established sessions, learner routes, operator-issued recovery,
`/health`, and `/ready` do not call or probe Resend. Email requests retain their
generic sanitized public behavior when provider delivery fails. Readiness
therefore describes the application, Mongo, and curriculum—not live email
provider reachability.

### Issuance and delivery acknowledgement

Email credentials follow this sequence:

`database issuance transaction → commit → one bounded provider attempt → conditional delivery acknowledgement → generic response`

No Mongo transaction remains open while waiting for Resend, its timeout, or the
750 ms public-response timing floor. The timing floor uses an asynchronous timer
and does not block the Node event loop.

A password-reset token or login-code digest is initially committed with no
`sentAt`. It cannot be consumed or verified until a conditional authoritative
delivery acknowledgement sets `sentAt`. If Resend accepts a message but the
acknowledgement update matches no record or fails to persist, CodeLift
conditionally revokes the credential and emits only sanitized aggregate
failure telemetry. It does not reveal the credential or blindly retry delivery.
The learner may use the normal bounded request flow to obtain a replacement.
This fail-closed rule applies equally to reset links and sign-in codes.

Six-digit codes are generated with a cryptographically secure bounded random
integer. Mongo stores only a purpose- and record-bound HMAC digest, hidden from
ordinary model selection. Comparison is constant-time. A code expires after ten
minutes, is single-use, has a five-attempt ceiling, and is subject to request,
verification, and cooldown limits. Expired records remain unusable and are
TTL-deleted seven days later.

### Provider and secret boundary

Each provider request carries a deterministic SHA-256-derived opaque idempotency
key bound to purpose and internal record ID. The metadata contains no raw Mongo
ID, user ID, email, reset token, login code, or session identifier. The
destination mailbox is the only inherently required user identifier sent for
delivery. The adapter makes one bounded attempt; it has no automatic retry that
could create ambiguous active-code state.

Production Resend keys and the independent login-code pepper are read from two
exact mode-0600, operator-owned, non-symlink files outside the repository. Only
the API receives those mounts. Direct secret environment values and the fake
test provider fail closed in production. The guarded fake outbox is restricted
to tests, synthetic `.example.test` recipients, private temporary storage, and
one-time reads.

The private self-host state remains email-disabled until explicit operator
setup. Configuring or rotating Resend is an operator action; no account, DNS,
secret, purchase, or live-send mutation is performed by source verification.
Pepper rotation first creates a fresh encrypted backup, stops the API,
invalidates all outstanding sign-in codes, rotates the pepper, and restarts the
API. Provider-key rotation retains one local rollback value until explicitly
finalized or rolled back.

## Consequences

Email self-service access can be source-complete and locally verified without
claiming that delivery is operational. Provider outage can delay or prevent new
email credentials, but it cannot remove normal password access, invalidate
existing sessions, block operator recovery, or make unrelated readiness fail.

There is an unavoidable residual timing and delivery-observation surface around
external email. Generic responses, a 750 ms floor, identical public status and
body, bounded attempts, and sanitized aggregate telemetry reduce that surface;
they do not make internet email delivery perfectly indistinguishable.

Live email remains blocked on explicit operator setup, verified sender/domain,
protected secret creation, and a separately authorized synthetic delivery test.
