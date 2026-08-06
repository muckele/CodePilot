# Evaluation strategy

CodeLift uses deterministic tests first and treats model output as untrusted.

The canonical dataset is `evals/datasets/local-safety-v1.json`, with dataset
version `local-behavior-v2`. Its 38 strict executable cases contain scenario
inputs, expected behavior, and deterministic assertions for schema validity,
required/forbidden language, usefulness, retrieval recall/relevance, grounding,
citations, abstention, direct/indirect injection, tenant isolation, private-note
consent, refusal/error/timeout normalization, tool arguments/authorization,
duplicates, budgets, approval boundaries, cost, and unsafe output handling.

`@codelift/evals` is the single assertion and critical-gate engine used by the
CLI and API. The Evals UI consumes the API's persisted result. `pnpm eval:local`
uses synthetic provider transports without an external network call or model
download and writes `reports/local-ai-eval.json`. Each report records the dataset
SHA-256, evaluator/provider/config versions, input, expected assertions, observed
values, assertion outcomes, timing, cost, critical failures, and evaluator
negative-control result. Allowlist, argument, and authorization cases execute
the production `PlannerToolRegistry` with deterministic read-only handlers;
duplicate and budget fixtures stop at the graph's pre-execution guard and prove
that no handler ran.

Unit tests deliberately corrupt a critical observation and an expected fixture;
both must lower the score and fail the critical gate. Real-Mongo integration
persists and reloads case-level evidence. Static security and browser checks
supplement this behavioral floor; they are not substitutes for executed cases.

External-provider comparisons are opt-in only. Such a comparison command must
record dataset version, provider, model identifier, prompt version, sampling
configuration, latency, estimated cost, refusal/error outcomes, and raw-output
retention policy. Human rubric review or an LLM judge may supplement the
deterministic floor; neither may override a failed privacy, citation,
authorization, or budget gate.

Release fails on any schema error, cross-tenant exposure, false grounding,
unapproved action, secret exposure, or unhandled provider outage even if an
aggregate score is high.
