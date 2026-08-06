# CodeLift AI V2 — Small Codex Launcher Prompt

Place these files in the repository root before using this launcher:

- `codelift_ai_codex_master_prompt_v2_2026.md`
- `codelift_ai_curriculum_seed_v2_2026.json`

Then paste the text below into Codex:

---

Read `codelift_ai_codex_master_prompt_v2_2026.md` in full and treat everything between `MASTER PROMPT START` and `MASTER PROMPT END` as the controlling product/build specification. Read `codelift_ai_curriculum_seed_v2_2026.json` as the machine-readable canonical curriculum source.

Before writing product code:

1. inspect the repository and existing instructions;
2. validate that the curriculum JSON contains exactly Days 1–365, that Days 1–364 form 52 seven-day weeks, every Core schedule totals 30 minutes, and every day has resources, an artifact, and a Recovery task;
3. create or update `AGENTS.md`, `PLANS.md`, and the first milestone acceptance checks;
4. state assumptions in `PLANS.md`, not as routine questions to me.

Then execute the closed loop from the master specification:

`INSPECT → PLAN → TEST → BUILD → VALIDATE → SCORE → REPAIR → VISUAL QA → DOCUMENT → REPEAT`

Work in coherent vertical slices. Do not stop at scaffolding. Do not claim completion unless all relevant commands have run successfully, the milestone score is at least 95/100, and there are no critical failures. Keep mock/free mode fully functional without a paid API key. Preserve the MERN core, Python/FastAPI service, accessibility, ethical reinforcement rules, curriculum invariants, AI security boundaries, and provider-independent evals.

Begin with repository inspection and Milestone 1. Continue through unblocked work without asking for routine confirmation.
