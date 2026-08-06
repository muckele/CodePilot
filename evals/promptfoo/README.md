# Promptfoo-style local evaluation contract

`../datasets/local-safety-v1.json` is the provider-independent executable dataset.
The default `pnpm eval:local` command executes its synthetic coach, RAG, tool,
planner, privacy, and output-handling scenarios through the shared
`@codelift/evals` assertion engine. It makes no external network call or model
download and writes a machine-readable expected-versus-observed report. An
external provider may be compared only through an explicitly named, opt-in
command that records provider, model, prompt, dataset, and configuration versions;
an LLM judge cannot replace deterministic privacy, authorization, citation, or
budget gates.

The 38 cases cover strict/malformed output, required and forbidden language,
usefulness, recall/relevance, grounding, citation resolution, abstention,
direct/indirect injection, tenant isolation, consent, refusal/error/timeout,
tool arguments/authorization/duplicates, budgets, agency, cost, and safe output
rendering.
