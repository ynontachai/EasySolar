# EasySolar production readiness and release runbook

## Release boundary

Public output is a preliminary DC-side engineering aid. It is not a final design approval. The order/contact action is available only when both equipment revisions are verified, every safety-critical input is present, no unresolved bifacial-current model exists, and at least one configuration passes every hard rule.

## Required production configuration

- `DATABASE_URL` (or supported Vercel/Supabase equivalent) with `sslmode=require`
- Private object storage: `S3_BUCKET`, `S3_REGION` and credentials when IAM is not used
- Supabase Auth public configuration and server-only `SUPABASE_SERVICE_ROLE_KEY`
- `FILE_SCAN_MODE=external`
- Unique `EASYSOLAR_SCANNER_TOKEN`
- Random server-only `RATE_LIMIT_SALT` of at least 32 bytes
- `SIZING_RATE_LIMIT_PER_MINUTE` (default policy: 30)
- Correct `NEXT_PUBLIC_SITE_URL` and optional LINE OA URL

Never configure `EASYSOLAR_E2E_ALLOW_DEMO` in a deployment. The application additionally requires `CI=true` before that test-only switch can expose fixtures.

## Database deployment

Apply every timestamped migration, including `20261109000100_production_sizing_guardrails.sql`, before deploying the application. Existing rows that predate the new not-valid constraints remain fail-closed in the engine; review, correct and re-verify them before publishing.

## Pre-deploy gates

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm test`
5. `npm audit --omit=dev --audit-level=high`
6. `npm run build`
7. `npm run test:e2e`
8. Confirm `/api/ready` returns HTTP 200 in Preview with production-equivalent secrets.
9. Verify at least one real PV module and inverter revision from the downloadable Datasheets against golden calculations approved by the engineering owner.

## Smoke test after deploy

- `/api/health` returns the expected engine version.
- `/api/ready` returns 200 without exposing secret values.
- Demo manufacturer/model names are absent.
- An incomplete revision cannot produce a candidate or order action.
- A verified golden pair reproduces the approved hot Vmp, cold Voc, cold Vmp, per-MPPT Ns/Np, current and total power.
- Security headers include CSP, HSTS, frame denial and content-type protection.
- Scanner claim/callback and signed Datasheet download work with production storage.

## Rollback

Rollback the application deployment first. Do not delete calculation snapshots or verification events. The guardrail migration is additive and should normally remain applied. Recall any affected Datasheet revision rather than editing its published history.
