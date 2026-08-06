# Contributing

Read `AGENTS.md`, `PLANS.md`, and the active milestone file before editing.

Use the pinned Node and pnpm versions, install from the workspace root, and keep
the canonical curriculum artifacts unchanged.

For a change:

1. identify the user-visible acceptance criterion;
2. add or locate the focused failing test;
3. implement the smallest correct behavior;
4. run the focused suite;
5. run broader affected quality gates;
6. update plan/evidence and an ADR when the architecture changes.

Do not add empty future-framework folders or success-only placeholder scripts.
Later milestone gates may be documented as not applicable with a reason, but
must not be counted as passing.

Use specific, non-shaming learner copy and preserve keyboard, contrast,
reflow, dark-theme, and reduced-motion behavior.

Changes under the reviewed web/API/contract/curriculum source invalidate the
source-bound browser evidence. Repeat the complete browser acceptance pass and
update `docs/quality/release-manual.json`; do not copy forward the prior digest.
