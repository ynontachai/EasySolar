# EasySolar Equipment Intelligence

Initial MVP scaffold for a transparent PV module–inverter compatibility checker. The current catalog contains synthetic, unverified records only; the UI and engine intentionally return `INSUFFICIENT_DATA` until real datasheet revisions pass verification.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Current routes

- `/` — public landing page
- `/equipment` — catalog scaffold
- `/checker` — working server-authoritative sizing flow
- `/admin/equipment` — verification workflow scaffold
- `/api/health` — health and engine version

## Guardrails

- Do not turn demo fixtures into published equipment.
- Do not make an LLM or client-side calculation authoritative.
- Do not silently fill missing safety-critical values.
- Do not rewrite historical calculations when a datasheet or rule changes.

Read [requirements contract](docs/requirements-contract.md), [UX handoff](docs/ux-handoff.md), [architecture](docs/architecture.md), and the first PostgreSQL migration in `db/migrations/0001_initial.sql` before implementing persistence.
