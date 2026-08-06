# Curriculum maintenance guide

The supplied JSON is the immutable canonical blueprint. Do not silently edit
it to mimic runtime enrichment.

1. Run `pnpm curriculum:preflight` to validate the exact 365-day source,
   mapping, schedules, resources, prerequisites, and final day.
2. Run `pnpm curriculum:validate` to generate and validate all display fields:
   objectives, mental models, common mistakes, three knowledge checks,
   Recovery/Stretch estimates, topic hints, teach-back, retrieval prompts, and
   evidence types.
3. Run `pnpm curriculum:links`. It checks source/catalog fidelity and performs
   bounded HEAD→GET reachability with timeout, retry, and evidence. A transient
   block becomes `unknown`; malformed URLs, unknown IDs, and catalog drift fail.
4. Run `pnpm seed` twice and `pnpm seed:validate`. Counts must remain 365
   curriculum days, 88 resources, three achievement definitions, three feature
   flags, and one eval dataset.
5. Review resource changes for free/official status, HTTPS, topic fit, and
   license. Do not copy course transcripts.
6. Update source hash evidence, tests, maintenance notes, and any affected
   portfolio story.

Day 365 must remain the release, mastery-audit, and continuation-plan day.
