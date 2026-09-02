# Security policy

## Trust model

The browser is untrusted and calls only the Express API. Express owns
authentication, authorization, tenant scope, consent, rate limits, and public
policy. MongoDB and FastAPI are private service boundaries. Model/provider
output and indexed note text are untrusted data.

## Implemented controls

- Argon2id password hashing; passwords and confirmation values never persist.
- Random opaque HTTP-only sessions; only SHA-256 token/CSRF hashes are stored.
- secure `__Host-` cookie in production, bounded idle/absolute expiry, rotation,
  logout invalidation, and generic credential failure.
- exact configured Origin plus CSRF header for every mutation; explicit CORS.
- Helmet, disabled framework banner, 32 KB JSON limit, bounded field schemas,
  mutation/auth rate limits, request IDs, and normalized problem responses.
- runtime parsing at browser/API/Python/provider boundaries; no raw HTML escape
  hatch or browser provider SDK.
- all user-owned reads/writes include authenticated `userId`; real-Mongo tests
  prove account and note isolation.
- completion requires explicit evidence and reflection; reflection saves and
  terminal completion serialize through one transactional progress version so
  a concurrent draft cannot invalidate a completed mission.
- indexed chunks carry source/version/user metadata; retrieval returns support
  labels and citations or abstains; source/account deletion removes vectors.
- provider secrets are backend-only; remote execution requires configuration,
  an HTTPS OpenAI endpoint with redirects rejected, profile opt-in, per-request
  consent, timeout/retry, a 64 KiB streamed response limit, strict JSON output,
  and `store: false`; kill switch forces deterministic mock without contacting
  any configured provider.
- traces minimize private data using hashes and bounded metadata.
- planners use feature flags, unlock rules, read-only proposals, hard budgets,
  duplicate detection, terminal reasons, and an atomic authenticated
  approval/revision claim before any decision work.
- containers run as non-root; Compose uses health/readiness checks and a private
  service topology suitable for a local stack.

## AI-specific boundary

The coach is educational, identifies generated content, does not diagnose
health, judge worth, promise employment, or claim mastery. Indexed content is
never executed as a prompt/tool instruction. The planner exposes no generic
shell, network, email, or write tool. The MCP demo has three read-only public
curriculum tools and cannot read learner state.

`pnpm eval:local` covers schema, forbidden language, grounding, citations,
abstention, prompt injection, tenant isolation, approval, budgets, cost,
consent, and fallback without a provider call. `pnpm security:check` scans for
secrets/browser bypasses and verifies required controls. `pnpm security:audit`
fails high/critical dependency advisories.

## Data lifecycle

Account deletion requires password re-verification and `DELETE` confirmation,
then acquires the same transactional User write fence used by user-owned
creates/upserts and removes progress, reflections, XP, user achievements,
skills, reviews, misconceptions, Error Museum, portfolio, AI traces, eval runs,
indexed sources/embeddings, agent runs, job applications, sessions, and user.
That shared fence prevents an already-authenticated in-flight request from
recreating an orphan record after deletion commits. Password-reset issuance
revokes older unused links; a successful reset revokes every sibling link and
session.
See the [data lifecycle runbook](docs/runbooks/data-lifecycle.md).

## Secrets

- Never commit `.env` files, provider keys, private keys, database credentials,
  personal notes, or production cookies.
- Never expose a provider key through a Vite/browser variable.
- Inject production secrets from a secret manager and rotate any exposed value
  before repository cleanup.
- Do not add raw private prompt/reflection logging to debug an incident.

## Reporting

Do not open a public issue with a live secret or learner data. Give the
repository owner a minimal redacted reproduction with route/component, impact,
preconditions, request/trace IDs or hashes, cross-boundary scope, and a proposed
regression test.

Follow [incident response](docs/runbooks/incident-response.md). An auth bypass,
cross-user disclosure, secret exposure, unsafe agent action, invalid
curriculum, data loss, false completion, or unhandled provider outage is a
critical release failure regardless of numeric score.

The detailed threat analysis is in
[docs/security/threat-model.md](docs/security/threat-model.md).
