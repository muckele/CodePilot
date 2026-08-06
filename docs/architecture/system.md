# CodeLift AI system architecture

## Context

```mermaid
flowchart LR
  Learner["Learner in browser"] --> Web["React + Vite web app"]
  Web -->|"HTTPS JSON, cookie + CSRF"| API["Express policy boundary"]
  API --> Mongo[("MongoDB product state")]
  API --> Curriculum["Validated 365-day curriculum package"]
  API -->|"typed internal HTTP, timeout"| Python["FastAPI AI/data service"]
  Python --> Mock["Deterministic mock providers"]
  Python -. optional .-> Local["Local model adapter"]
  API -. explicit opt-in .-> Remote["Optional Responses API"]
  Maintainer["Maintainer"] --> Seed["Seed / validate / link / eval tools"]
  Seed --> Mongo
  Postgres[("PostgreSQL curriculum lab")] -. no product dependency .-> Maintainer
```

The browser never receives a provider key and never calls Python or a model
provider. Express is the only public policy boundary.

## Containers and trust boundaries

```mermaid
flowchart TB
  subgraph BrowserBoundary["Untrusted browser boundary"]
    UI["React UI"]
    Scratch["Browser-local scratch draft"]
  end
  subgraph NodeBoundary["Authenticated Node boundary"]
    Routes["Versioned routes + Zod"]
    Auth["Argon2id + opaque sessions + exact-origin CSRF"]
    Learning["Progress, review, portfolio, RAG, coach, planner services"]
    Gateway["Provider gateway + fallback + traces"]
  end
  subgraph DataBoundary["Private persistence boundary"]
    Product[("Mongo product collections")]
    Index[("Tenant-scoped indexed sources")]
  end
  subgraph InternalBoundary["Internal Python boundary"]
    FastAPI["Pydantic endpoints"]
    Analytics["pandas / scikit-learn baseline"]
    Providers["mock embedding / reranker / local inference protocols"]
  end

  UI --> Routes
  Routes --> Auth
  Auth --> Learning
  Learning --> Product
  Learning --> Index
  Learning --> Gateway
  Gateway --> FastAPI
  FastAPI --> Analytics
  FastAPI --> Providers
```

## Major components

- `packages/contracts`: strict runtime contracts shared by browser and Node.
- `packages/config`: environment-neutral product paths and stable operational /
  input limits shared by browser and Node; runtime validation remains in the
  contracts and service boundaries.
- `packages/curriculum`: immutable source preflight plus deterministic,
  display-ready enrichment.
- `packages/evals`: shared executable behavioral evaluation used by the CLI,
  API, UI, and release-quality report.
- `packages/ui`: accessible React state and live-status primitives that render
  against the web app's semantic design-token classes.
- `apps/api/account`: authentication, onboarding, progress state machine,
  evidence, reflection, and deletion transaction.
- `apps/api/learning`: roadmap, reviews, skills, task plans, portfolio/career,
  private notes, RAG, coach, planner, traces, and evals.
- `services/ai`: stateless typed analysis and provider protocols.
- `services/mcp`: separate read-only public-curriculum demo with three
  allowlisted tools and no learner access.

## Important flows

### Evidence-backed completion

```mermaid
sequenceDiagram
  participant B as Browser
  participant N as Node API
  participant M as MongoDB
  B->>N: Start Core or Recovery (CSRF + idempotency)
  N->>M: Upsert unique user/day progress
  B->>N: Save evidence and reflection draft
  N->>M: User-scoped validated writes
  B->>N: Complete with expected version
  N->>M: Validate evidence + reflection, transition atomically
  N-->>B: Distinct Core/Recovery completion
  N->>M: Derive XP, reviews, skills, achievements, portfolio evidence
```

### Grounded note answer

```mermaid
sequenceDiagram
  participant B as Browser
  participant N as Node API
  participant I as IndexedSource
  B->>N: Save private note
  N->>I: Hash, version, chunk, embed with userId
  B->>N: Ask question
  N->>I: Hybrid retrieve with same userId
  alt sufficient support
    N-->>B: Supported statements + source/chunk citations
  else insufficient support
    N-->>B: Explicit abstention + no fabricated citation
  end
```

### Durable bounded plan

```mermaid
sequenceDiagram
  participant B as Browser
  participant N as Node API
  participant G as Typed planner graph
  participant T as Authorized tool registry
  participant M as MongoDB
  B->>N: Propose week (CSRF + idempotency key)
  N->>M: Create running AgentRun with initial graph state
  loop bounded read-only nodes
    G->>T: Runtime-validated user-scoped tool call
    T-->>G: Runtime-validated result
    G->>M: Persist repeat-safe checkpoint and trace
  end
  G-->>B: Await human review with evidence, budget, and trace
  B->>N: Approve or revise (expected status + idempotency key)
  alt current proposal-only policy
    N->>M: Record accepted proposal; no product/task write
  else explicitly configured persistence policy
    G->>T: Authorized write only after approval
    T->>M: Idempotent approved-plan persistence
  end
```

## Failure behavior

- Mongo required mode: readiness fails and private routes do not use memory.
- Python/provider outage: timeout is bounded and Node returns deterministic
  validated fallback.
- Invalid curriculum: readiness fails closed; no fabricated mission.
- Unsupported RAG question: explicit abstention.
- Planner budget, validation, authorization, kill-switch, or approval boundary:
  the graph fails closed or falls back deterministically, records a terminal
  reason, and performs no unapproved side effect.

See the ADRs, threat model, and runbooks for decision and operational detail.
