# ADR 0005: Tenant-scoped indexed-source abstraction

- Status: accepted
- Date: 2026-07-24

## Context

Personal notes require ingestion, versioning, retrieval, citations, and
deletion. A production vector engine may change, but account isolation and
source provenance cannot.

## Decision

Represent the retrieval boundary as `IndexedSource` documents containing
versioned chunks, hashes, metadata, and deterministic embeddings. Every read,
write, search, update, and delete includes the authenticated `userId`.
Retrieval combines lexical and deterministic cosine scores, returns resolvable
source/chunk citations, labels support, and abstains below a threshold.

The storage shape is an adapter boundary: a future pgvector or dedicated vector
index must preserve `(userId, sourceId, version, chunkId)` metadata and deletion
semantics. Product operation does not depend on PostgreSQL.

## Consequences

- The no-model path is reproducible and testable.
- Deterministic vectors are a baseline, not a claim of production semantic quality.
- Moving to another vector store requires tenant-leakage and deletion regression tests.
