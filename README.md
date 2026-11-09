# EasySolar Equipment Intelligence

Production-oriented PV module–inverter compatibility checker. Public recommendations are fail-closed: missing safety-critical values, unverified revisions, or unresolved bifacial current prevent an orderable result. Synthetic records are available only outside production and in the isolated CI browser test mode.

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

Production malware scanning runs from `.github/workflows/datasheet-scanner.yml`. The worker claims one pending asset per unique SHA-256, downloads it through a 15-minute signed URL, validates its PDF signature, size and checksum, scans it with updated ClamAV signatures, and posts the verdict back to the authenticated callback. Configure the same `EASYSOLAR_SCANNER_TOKEN` in Vercel Production and GitHub Actions secrets; optionally set the GitHub Actions variable `EASYSOLAR_BASE_URL` when the production origin changes.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Current public flow

- `/` — EPC-first landing page with server-authoritative sizing, formula trace and verified-order boundary
- `/checker`, `/equipment`, `/solar-value`, `/community-buy` — temporary redirects to the single-page experience
- `/admin/login` — invite-only Admin sign-in
- `/admin/catalog` — role-scoped SKU creation and list
- `/admin/equipment` — role-scoped Datasheet verification workflow
- `/admin/users` — Super Admin invitation email and role assignment
- `/api/health` — health and engine version
- `/api/ready` — production dependency readiness (returns 503 until all required capabilities are ready)
- `/api/v1/admin/datasheets/upload-intents` — authenticated signed upload intent
- `/api/v1/admin/datasheets/{assetId}/finalize` — object integrity verification
- `/api/v1/admin/datasheets/{assetId}/scan-verdict` — scanner callback
- `/api/v1/admin/datasheets/scan-jobs` — authenticated scanner work queue
- `/api/v1/datasheets/{revisionId}/download` — signed download for available verified files

## Guardrails

- Do not turn demo fixtures into published equipment.
- Do not make an LLM or client-side calculation authoritative.
- Do not silently fill missing safety-critical values.
- Do not rewrite historical calculations when a datasheet or rule changes.
- Do not show an order action unless the result is `PRELIMINARY_COMPATIBLE`, every blocker is cleared, and both revisions are verified.

Read [production readiness and release runbook](docs/production-readiness.md) before deployment.

Read [product blueprint](docs/product-blueprint.md), [journey–feature alignment](docs/journey-feature-map.md), [data and file architecture](docs/data-architecture-plan.md), [admin catalog operations](docs/admin-catalog-operations-plan.md), [Supabase setup walkthrough](docs/supabase-setup-walkthrough.md), [requirements contract](docs/requirements-contract.md), [UX handoff](docs/ux-handoff.md), [architecture](docs/architecture.md), and the first PostgreSQL migration in `db/migrations/0001_initial.sql` before implementing persistence.
