# CodeLift AI Repository Instructions

These instructions apply to the entire repository.

## Start here

1. Read `PLANS.md` before changing code.
2. Read the active milestone file under `docs/milestones/`.
3. Inspect the affected package and its tests before editing.
4. Keep changes inside the active vertical slice unless a root-cause repair
   requires a small adjacent change.

The controlling product specification is
`codelift_ai_codex_master_prompt_v2_2026.md`. The canonical curriculum source is
`codelift_ai_curriculum_seed_v2_2026.json`. Do not silently rewrite either
source artifact.

## Architecture invariants

- Preserve the TypeScript-first monorepo and MERN product core.
- The browser talks only to the Node API.
- The Node API owns authentication, authorization, public policy, and
  user-facing API contracts.
- The Python service is an internal AI/data service and must degrade safely when
  unavailable.
- MongoDB is the product database. PostgreSQL remains a curriculum lab or an
  optional analytics/vector implementation.
- Keep shared wire schemas in `packages/contracts`, curriculum parsing and
  validation in `packages/curriculum`, and reusable visual primitives in
  `packages/ui`.
- Do not couple product behavior to one AI vendor. Mock/free mode must remain a
  complete, deterministic path.

## Language and boundary rules

- Use strict TypeScript. Avoid `any`; begin decoded or external data as
  `unknown` and parse it.
- Use Python typing and Pydantic at HTTP boundaries.
- Validate every external boundary, including files, environment variables,
  browser input, database records, service responses, AI output, tool
  arguments, and retrieved content.
- Treat AI output as untrusted input. Never write it directly to trusted state
  or render unsafe markup.
- Authorize user-owned data at the query or execution boundary. A valid schema
  is not authorization.
- Use stable idempotency keys for repeatable mutations and XP events.

## Security and privacy

- Never place secrets, API keys, tokens, or model credentials in source code,
  fixtures, browser bundles, logs, screenshots, or prompts.
- Keep provider credentials server-side and optional.
- Use secure HTTP-only cookie authentication with a documented CSRF strategy
  when authentication enters the active slice.
- Minimize sensitive content in logs and AI traces.
- Scope product records, derived chunks, embeddings, caches, and search results
  to the owning user.
- Derived data must follow the deletion lifecycle of its source.
- Agents and tools are read-only by default, allowlisted, budgeted, traced, and
  approval-gated before side effects.
- Do not depend on deprecated hosted eval or fine-tuning products.

## Curriculum invariants

- There are exactly 365 sequential days.
- Days 1 through 364 form exactly 52 seven-day weeks; Day 365 is the final
  release, mastery audit, and continuation day.
- Every Core schedule totals exactly 30 minutes.
- Every day has at least one official/free HTTPS resource, a concrete artifact,
  a Recovery task, skill tags, and valid past-only prerequisites.
- Generated display content must add three knowledge checks: recall,
  application, and explanation/tradeoff.
- A missed calendar day never silently advances the curriculum.
- Core completion and Recovery completion remain distinct states.
- A transient third-party link failure never deletes a curriculum resource.

Run the focused curriculum validator after any curriculum or contract change.

## Learning and reinforcement rules

- Reinforce autonomy, competence, returning, testing, explaining, debugging,
  and shipping evidence.
- Use concise, specific, non-shaming copy.
- Never use destructive streak resets, randomized reward boxes, fake urgency,
  manipulative notifications, forced social comparison, or fabricated praise.
- Never celebrate unvalidated work or imply that a Recovery win completed the
  full Core mission.
- Do not claim that the learner understands a concept without retrieval or
  artifact evidence.

## Accessibility and visual quality

- Use semantic landmarks and native controls.
- Preserve visible focus, keyboard operation, contrast, zoom/reflow, screen
  reader names, and non-color status cues.
- Every motion effect needs a `prefers-reduced-motion` alternative.
- Charts and signature graphics need text equivalents.
- The visual direction is “Cosmic Sunrise Workshop”: warm, calm, optimistic,
  technically credible, and never casino-like.
- Use design tokens instead of scattered raw values.

## Testing and completion

Use a red-green-refactor loop for domain logic, progress transitions,
curriculum validation, auth, AI schemas, retrieval, and agent budgets.

1. Write or identify the focused failing test.
2. Implement the smallest correct behavior.
3. Run the focused test.
4. Refactor while green.
5. Run the broader affected suite.

Never claim success without command evidence. A milestone passes only when:

- all active acceptance criteria are visibly satisfied;
- relevant lint, typecheck, tests, validators, and builds pass;
- the score in the milestone file is at least 95/100;
- no critical failure remains;
- `PLANS.md` records commands, results, risks, and the next slice.

After twelve focused attempts on the same blocker, record exact evidence and a
safe fallback in `BLOCKERS.md`, then continue unblocked work.

## Documentation

- Record material architecture decisions as ADRs.
- Update `README.md` when startup, configuration, behavior, or limitations
  change.
- Keep `.env.example` aligned with runtime configuration.
- State measured results as measurements, not estimates presented as facts.
- Disclose meaningful AI assistance in portfolio documentation without
  overstating independent authorship.
