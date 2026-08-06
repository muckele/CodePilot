# AI operations, quality, cost, and outage runbook

## Signals

Use the private Evals/operations view and `/api/v1/ai/operations` to inspect
provider capability, outcome, prompt version, latency, estimated cost,
citation count, and kill-switch state. Traces store an input hash rather than
private reflection text.

The default mock and Python-mock routes have estimated provider cost `$0`.
Planner budgets cap steps, tokens, cost, and wall time even when bounded-agent
mode is enabled. Planner traces expose node completion, validated tool calls,
checkpoints, fallbacks, human decisions, and terminal reasons without storing
raw private note text. The current product approval policy is `proposal_only`:
approval records acceptance but does not claim to save tasks or a calendar plan.

## Provider outage or malformed output

1. Confirm `/health`, `/ready`, and the Python `/health` endpoint.
2. Inspect recent trace outcomes without copying private input into a ticket.
3. Set the seeded `ai-kill-switch` feature flag to enabled through an
   authorized operational process.
4. Verify the coach returns generated content labeled `mock` with outcome
   `fallback`; do not present provider output from the failed request.
5. Run `pnpm eval:local`, `pnpm test:integration`, and the provider-boundary
   unit tests.
6. Re-enable only after structured output, timeout, refusal, consent, and
   fallback cases pass.

## Quality regression

1. Freeze prompt/provider changes and preserve version metadata.
2. Reproduce on the versioned local dataset.
3. Classify failure as schema, safety, grounding, citation, retrieval,
   authorization, agency, latency, or cost.
4. Repair the smallest root cause; never loosen a critical deterministic gate
   to improve an average.
5. Compare fixed-dataset results and manually review changed output.

## Cost or runaway-agent event

1. Enable the AI kill switch and disable the bounded-planner feature flag.
2. Confirm no run exceeds seven actions or persisted budget values.
3. Inspect duplicate-operation keys and terminal reasons.
4. Confirm the latest checkpoint belongs to the same user and run, and resume
   it rather than replaying completed tools.
5. Revoke or rotate a provider key if unexpected remote use occurred.
6. Treat any unapproved side effect as a critical security incident.

## Privacy incident

Do not paste source text into logs or chat. Record affected account IDs,
source/trace IDs, and hashes. Disable retrieval/provider paths, preserve
minimal redacted evidence, follow `incident-response.md`, and verify the
account deletion cascade before restoration.
