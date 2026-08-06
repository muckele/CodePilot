# System-design walkthrough

## Requirements

The critical journey is registration → onboarding → next incomplete mission →
evidence/reflection → honest Core or Recovery completion → reviews/skills/
portfolio → grounded assistance. The system must remain useful with no paid
provider and must never expose one learner’s private content to another.

## API and data

Express exposes versioned JSON routes with shared Zod contracts. Mongo unique
indexes enforce user/day progress, XP idempotency, source and agent ownership,
and stable global seed keys. Sessions are opaque and hashed; writes require
exact Origin and CSRF. Python is internal and stateless.

## Scaling

Stateless web/API/Python containers can scale independently. Mongo indexes
follow account-scoped query patterns. Curriculum is validated once and held as
an immutable read model. Retrieval currently scans one user’s bounded source
set; the adapter metadata supports moving to pgvector or a vector service when
measured load requires it.

## Reliability

Health and readiness separate liveness, curriculum validity, and persistence.
Provider calls use timeout/retry and validated fallback. The planner has hard
budgets and a human gate. Idempotency prevents repeated evidence, job, task,
skip, and decision actions.

## Security and privacy

Authorization is applied at data/execution boundaries; the browser owns no
provider secret. Traces hash sensitive input. RAG carries user/source/version
metadata. Deletion is transactional and cascades derived data. Static checks,
integration tests, local evals, and a threat model guard ordinary web and AI
risks.

## Tradeoffs

Native routing avoids the unused vulnerable SSR/RSC surface discovered during
M1 but lacks a full router’s nested-route abstractions. Deterministic embeddings
give reproducible zero-cost behavior but lower semantic recall than a measured
model. Docker images favor reproducibility and clarity over minimal byte size.
