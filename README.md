# EasySolar Equipment Intelligence

Initial MVP scaffold for a transparent PV module–inverter compatibility checker. The current catalog contains synthetic, unverified records only; the UI and engine intentionally return `INSUFFICIENT_DATA` until real datasheet revisions pass verification.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Datasheet storage

The Datasheet intake foundation requires PostgreSQL plus private S3-compatible storage. Link the Supabase CLI and apply the timestamped migrations under `supabase/migrations/`, then configure the variables documented in `.env.example`.

The storage bucket must allow browser `PUT` requests from the application origin with these headers:

- `content-type`
- `x-amz-checksum-sha256`
- `x-amz-meta-assetid`
- `x-amz-meta-sha256hex`

`FILE_SCAN_MODE=external` keeps uploaded files unavailable until the authenticated scanner callback reports `clean`. `trusted-dev` may be used only in non-production development. Admin pages use an invite-only Supabase Auth session plus application roles; the scanner token is never an Admin login credential. Super Admins send invitations from `/admin/users`, which needs the server-only `SUPABASE_SERVICE_ROLE_KEY`.

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
- `/solar-value` — consumer assessment scope and delivery roadmap
- `/solar-value/new` — five-step consumer assessment with versioned tariff assumptions
- `/admin/login` — invite-only Admin sign-in
- `/admin/catalog` — role-scoped SKU creation and list
- `/admin/equipment` — role-scoped Datasheet verification workflow
- `/admin/users` — Super Admin invitation email and role assignment
- `/api/health` — health and engine version
- `/api/v1/admin/datasheets/upload-intents` — authenticated signed upload intent
- `/api/v1/admin/datasheets/{assetId}/finalize` — object integrity verification
- `/api/v1/admin/datasheets/{assetId}/scan-verdict` — scanner callback
- `/api/v1/datasheets/{revisionId}/download` — signed download for available verified files

## Guardrails

- Do not turn demo fixtures into published equipment.
- Do not make an LLM or client-side calculation authoritative.
- Do not silently fill missing safety-critical values.
- Do not rewrite historical calculations when a datasheet or rule changes.

Read [product blueprint](docs/product-blueprint.md), [journey–feature alignment](docs/journey-feature-map.md), [data and file architecture](docs/data-architecture-plan.md), [admin catalog operations](docs/admin-catalog-operations-plan.md), [Supabase setup walkthrough](docs/supabase-setup-walkthrough.md), [requirements contract](docs/requirements-contract.md), [UX handoff](docs/ux-handoff.md), [architecture](docs/architecture.md), and the first PostgreSQL migration in `db/migrations/0001_initial.sql` before implementing persistence.
