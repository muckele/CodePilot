# ADR 0004: TypeScript monorepo with an internal Python boundary

- Status: accepted
- Date: 2026-07-24

## Context

CodeLift’s product state, authentication, curriculum policy, and browser
contract form a MERN application. The curriculum also teaches Python, pandas,
scikit-learn, FastAPI, and optional local-model work. Putting product authority
in both runtimes would create two authentication and authorization systems.

## Decision

Use one pnpm TypeScript monorepo for the React client, Express API, contracts,
curriculum compiler, environment-neutral product configuration, and accessible
React primitives. Shared configuration contains stable paths and limits but no
secrets or environment parsing; runtime schemas remain the validation authority.
Keep FastAPI as an internal, stateless AI/data service behind typed Node
adapters. The browser calls only Node. Node owns identity, consent, tenant scope,
rate limits, and response validation. Python provides analysis, deterministic ML
support, embeddings, reranking, coach mocks, and optional local inference; it
never owns a user session.

The default Compose route uses `python_mock`, while Node falls back to its local
deterministic provider when Python is unavailable.

## Consequences

- One public policy boundary and one source of user authorization.
- Python can be replaced, restarted, or disabled without losing product state.
- Cross-runtime schemas and timeouts need explicit tests.
- The build has two language toolchains, both covered by root quality commands.
