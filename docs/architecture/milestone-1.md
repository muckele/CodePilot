# Milestone 1 Architecture

```mermaid
sequenceDiagram
  participant L as Learner browser
  participant W as React web
  participant A as Express API
  participant C as Curriculum package
  participant J as Canonical JSON

  W->>A: GET /api/v1/curriculum/1
  A->>C: read immutable day index
  Note over C,J: Source was hashed, parsed, and validated once at startup
  C-->>A: validated CurriculumSeedDay
  A-->>W: Zod-validated success payload
  W-->>L: accessible Day 1 preview

  alt API or contract failure
    W-->>L: unverified state + Retry
  end
```

## Trust boundaries

- JSON file → curriculum package: untrusted file input, parsed from `unknown`.
- curriculum package → API: immutable validated domain record.
- API → browser: untrusted network input, parsed again by shared schema.
- resource link → third-party course: user-initiated navigation only; no server
  proxy or automatic fetch.

## Operational behavior

`/health` answers whether the Express process is alive. `/ready` answers whether
the canonical curriculum loaded and passed validation. These states are
separate so a process cannot claim the curriculum is usable after source
failure.
