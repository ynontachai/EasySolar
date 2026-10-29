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
