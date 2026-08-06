# ADR 0001 — Server-owned canonical curriculum

- Status: Accepted
- Date: 2026-07-23

## Context

The supplied curriculum blueprint is about 964 KB and contains all 365 days.
The browser needs one day at a time. Importing the source into the web bundle
would duplicate a source of truth, expose the full file unnecessarily, and make
fail-closed validation difficult.

The raw blueprint is also not the final `CurriculumDay` model. It lacks
generated teaching fields and link-check metadata, so calling it display-ready
would create a false success state.

## Decision

- Keep the supplied root JSON byte-for-byte unchanged.
- Model it as `CurriculumBlueprint` / `CurriculumSeedDay`.
- Load, hash, parse, validate, and index it once on the server.
- Report preflight as `validationProfile: "blueprint"` and
  `displayReady: false`.
- Serve one validated day through the Express API.
- Share Zod wire schemas with the browser, which validates responses again.
- Fail readiness and curriculum requests closed if source validation fails.
- Keep later enrichment and link status as generated records, never silent
  mutations of the source.

## Consequences

The browser bundle stays small and cannot silently replace a failed API with a
stale embedded seed. Local development requires the Node API. Later database
seeding and curriculum enrichment have a clear, auditable source boundary.
