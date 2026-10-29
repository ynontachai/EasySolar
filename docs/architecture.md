# Architecture Baseline

```text
Next.js App Router
├── src/app                 Routes, server rendering and API handlers
├── src/components          UI and the narrow client workspace
├── src/domain/catalog      Canonical equipment contracts
├── src/domain/sizing       Pure deterministic engine + tests
├── src/data                Explicitly unverified demo adapter
└── db/migrations           PostgreSQL source-of-truth schema
```

The scaffold is a modular monolith. The calculation engine has no UI, HTTP, database, clock, randomness, analytics or LLM dependency. The application layer supplies calculation identity/time, while API handlers resolve server-owned equipment snapshots before calling the engine, so clients cannot substitute untrusted specifications.

## API scaffold

- `GET /api/health`
- `GET /api/v1/modules?q=`
- `GET /api/v1/inverters?q=`
- `GET /api/v1/equipment/{id}/revisions`
- `POST /api/v1/sizing/evaluate`

Persistence, report signing, RBAC, audit endpoints and analytics are intentionally not faked. Add repository adapters around the existing domain contracts after the database/provider decision.

## Target platform plan

The planned production baseline remains a modular monolith backed by PostgreSQL and private S3-compatible object storage. File scanning/report generation become background jobs when those features start. Engineering catalog records remain separate from merchant price and inventory so commercial ranking cannot alter safety results.

- [System context](architecture/c4-context.md)
- [Container architecture](architecture/c4-containers.md)
- [Journey–Feature alignment](journey-feature-map.md)
- [Data and file architecture](data-architecture-plan.md)
