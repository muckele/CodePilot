# Release governance

## Current repository state

As inspected on 2026-08-10, the remote default and only remote branch is
`codex/initial-build`; `main` does not exist. The M16 release branch is
`codex/mvp-launch-readiness` and its first draft pull request must target the
actual default branch. Do not create or switch the default branch as an
incidental part of this release.

The v0.1.1 self-service account-access work is developed on
`codex/v0.1.1-auth-access` from the approved design commit `94fd9cd`. Its
reviewable history includes the guardrail follow-up, implementation plan, and
strict RED → GREEN slices. This source state does not authorize a Resend account
change, DNS change, secret creation, purchase, or live send.

## Draft pull request and merge policy

1. Push only a clean, reviewed release branch whose head commit passed the
   source-bound gate.
2. Open a **draft** pull request against `codex/initial-build` with the M16
   scope, quality report, residual risks, and live-deployment blocker stated.
3. Require review from the release owner and security/data owner. The author
   cannot be the only approval for auth, export/deletion, or deployment changes.
4. Require the CI workflow and source-bound quality gate. Do not waive a failed
   critical command or missing backup-restore evidence with an aggregate score.
5. Merge only after the draft is marked ready, review threads are resolved, the
   head SHA still matches the evidence, and any chosen live environment passes
   its guarded check.
6. Prefer squash merge for the milestone unless the repository owner chooses a
   release-commit history. Delete the feature branch only after the merged SHA
   and rollback reference are recorded.

After an explicitly approved merge, deploy that immutable merge SHA through a
protected `production` GitHub Environment. Run the guarded live smoke against
the exact HTTPS origin and attach redacted health/readiness, synthetic journey,
alert, and isolated backup-restore evidence to the release record. Only after
those checks pass may the release owner create the annotated release tag for
the approved version (`v0.1.1` for this account-access release) at that deployed
SHA and publish release notes. The notes must identify the image
digests, migration/seed result, rollback SHA or digests, quality-report revision,
live-smoke time, known limitations, and data/backup policy. A tag or release is
never evidence that the environment passed these gates.

## Recommended branch protection

Apply to the eventual default branch and any release branch:

- pull requests required; two approvals for security/data lifecycle changes;
- dismiss stale approvals and require approval of the latest push;
- required status: CI plus source-bound release-quality gate;
- conversation resolution, linear history, signed commits where available;
- block force pushes and deletion; restrict bypass to a named emergency owner;
- require deployment-environment approval for production;
- cancel superseded workflow runs per branch, but never cancel an in-progress
  production deployment without incident-owner acknowledgment.

Production environment access should be limited to the release owner and one
backup operator. Use short-lived provider credentials where available. Mongo,
hosting, DNS, and optional AI secrets belong in environment secret stores and
must not be added until immediately before the first authorized deployment.
Rotate on owner change, suspected exposure, or incident containment.

If v0.1.1 email delivery is enabled, Resend sender/DNS changes and provider-key
creation require a distinct operator approval. Keep the Resend key and the
independent login-code pepper in separate protected secret files, expose both
only to the API, and never attach values to a pull request, CI output, issue,
evidence artifact, or chat. Source/local verification uses only the guarded fake
provider. Until a synthetic live-delivery gate is separately authorized and
recorded, release notes must say the feature is implemented but provider setup
is pending; password login and operator recovery remain the available paths.

Configure the GitHub `production` Environment only after owner approval:

- restrict deployments to the protected default branch and approved release
  tags; reject arbitrary feature branches and forks;
- add a required reviewer when the repository plan supports it, with the
  reviewer distinct from the deployment initiator for normal releases;
- store production origin, hosting credentials, Mongo URI, session secret, and
  any DNS/monitoring credentials as environment secrets, never repository
  variables or workflow artifacts;
- use a single production concurrency group with queued or rejected overlap so
  two revisions cannot deploy concurrently;
- put deployment jobs behind the Environment so its secrets are unavailable
  until branch restrictions and reviewer approval have passed;
- grant the workflow only the minimum GitHub permissions and use OIDC or
  short-lived provider credentials where supported.

The intended flow is therefore:

`implementation branch -> draft PR -> required quality check -> approved merge -> protected production Environment -> deploy exact SHA -> live smoke -> isolated restore evidence -> approved version tag -> release notes`.

## Safe initialization of `main` (playbook only)

Execute only after explicit repository-owner approval and after confirming the
default branch is still `codex/initial-build` and clean. These commands create
`main` at the existing default tip; they do not merge unrelated history:

```bash
git fetch origin --prune
git switch codex/initial-build
git pull --ff-only origin codex/initial-build
git switch -c main
git push -u origin main
```

Then change the GitHub default branch to `main`, apply protection, retarget any
open pull requests, and verify CI on `main`. Keep `codex/initial-build` until
all open work has been retargeted and the repository owner separately approves
deletion. If any command shows divergence or an unexpected SHA, stop; do not
force-push or reset.
