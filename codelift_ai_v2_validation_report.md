# CodeLift AI V2 Artifact Validation

Generated: 2026-07-23

## Files

- `codelift_ai_codex_master_prompt_v2_2026.md` — 427,697 bytes — SHA-256 `05c4541cc358579f0ec56a8ef2d8881e7c1cb49aeacfa5ccb33eda9a2ccaa1c6`
- `codelift_ai_curriculum_seed_v2_2026.json` — 964,412 bytes — SHA-256 `af4183cc6d139c34e7ebe63949055fa6fe2e89a25c54c707a4c67a219ed9eb99`
- `codelift_ai_codex_launcher_prompt_v2_2026.md` — 1,735 bytes — SHA-256 `310393e5cd158ce61d909154b21b070d0b3407d21c45fc2619b326f13ec3ea6e`

## Curriculum invariants

- Master prompt day headings: 365
- Machine-readable days: 365
- Day-number sequence: 1 through 365, with no gaps or duplicates
- Weeks: 52; Days 1–364 give exactly seven days to each Week 1–52
- Day 365: final release, mastery audit, and continuation plan
- Months: 12
- Resource catalog entries: 88
- Unique resource URLs: 87
- Every day has at least one resource
- Every Core schedule totals exactly 30 minutes
- Every day contains a concrete artifact and Recovery task
- All catalog resource URLs are syntactically valid HTTPS URLs
- Unknown resource references: 0
- Validation issues: 0

## Link-checking scope

The catalog was checked for valid HTTPS syntax and internal references. Key current sources were manually verified during roadmap research. Runtime availability, redirects, and course-page paths can still change, so the Codex specification requires bounded link checks in the generated application and must report moved or unreachable URLs without silently deleting curriculum content.
