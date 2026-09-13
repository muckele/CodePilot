# Milestone 17 — v0.1.1 self-service account access

## Outcome

CodeLift AI v0.1.1 preserves password login and adds three narrowly scoped
account-access capabilities: globally accessible sign out, **Forgot password**
email recovery, and **Email me a sign-in code** using a six-digit code. It does
not add SMS, OAuth/social login, open registration, or a fully passwordless
account model.

The source and local test boundary is distinct from provider operation. Resend
is not configured by this milestone work, no live email is sent, and the
private self-host state defaults to `EMAIL_PROVIDER=disabled`. Live delivery
requires the separate operator setup gate below.

## Acceptance matrix

| Area                    | v0.1.1 acceptance                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| password access         | existing password login continues to create a rotated opaque session and retains its generic failure response                                            |
| global sign out         | an authenticated learner can sign out from every protected shell; the server invalidates the session before the UI reports success                       |
| Forgot password         | existing and unknown mailboxes receive the same `202` body and timing floor; only a delivered, acknowledged, single-use reset link can change a password |
| Email me a sign-in code | existing and unknown mailboxes receive the same `202` body and timing floor; only the newest delivered six-digit code can create a session               |
| delivery state          | issuance commits before provider work; provider-success/database-acknowledgement failure revokes or leaves the credential unverifiable                   |
| transaction boundary    | no Mongo transaction spans provider I/O, provider timeout, or public-response timing equalization                                                        |
| provider availability   | runtime email outage does not affect password login, sessions, learner routes, operator reset, `/health`, or `/ready`                                    |
| provider privacy        | Resend idempotency metadata is opaque and exposes no raw internal/user identifier, token, code, or session value                                         |
| secret handling         | production accepts only file-backed Resend key and independent login-code pepper; API is the only recipient; test fake fails closed in production        |
| lifecycle               | email-code digests are absent from export, deleted with the account, unusable at expiry, and TTL-deleted seven days later                                |
| browser behavior        | password, reset, code, replay rejection, global sign-out, narrow layout, keyboard, reduced-motion, and generic unknown-email journeys are automated      |

## Evidence contract

The implementation uses strict RED → GREEN slices recorded in the v0.1.1
branch history. Unit and real-Mongo integration tests cover both acknowledgement
failure modes, single-use and attempt ceilings, sibling revocation, transaction
closure before provider/timer work, opaque provider metadata, outage isolation,
and configuration failure. Playwright uses only a guarded, one-time synthetic
outbox and never a live provider.

The final release claim requires the complete repository verification matrix,
source-digest-bound browser evidence, a clean committed revision, and exact-SHA
CI where available. Those gates prove source/local behavior only; they do not
prove sender ownership, DNS, provider credentials, inbox placement, or live
delivery.

## Operator setup gate

Before enabling Resend, an authorized operator must create or select the
provider account, verify the sending domain and sender, create the protected
provider-key file and independent pepper through the documented self-host
workflow, restart and verify readiness, perform a separately authorized
synthetic live-email test, and record redacted evidence. Secrets must never be
placed in source, Compose values, shell history, tickets, screenshots, or chat.

Until that work is explicitly authorized and completed, CodeLift remains
functional with email disabled and self-service email operations return their
generic response without affecting other account or learning functionality.
