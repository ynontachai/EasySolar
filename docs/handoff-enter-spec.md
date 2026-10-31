# Handoff: Enter spec (enter_spec) for Datasheet revisions

Written for: Codex (or any engineer) picking up the EasySolar Datasheet review workflow on `main`. Read `docs/codex-operating-rules.md` first.

## Decision (from product owner, 2026-10-31)

- Admin does all review work: enter spec, verify, reject, publish, recall. "Admin" = `account_admin` and `super_admin`.
- Four-eyes option (b): the spec author may verify their own spec, but must give a reason of at least 10 characters. The reason and a `selfVerified` flag are written to `verification_event`.
- `reviewer` role is kept in the code lists for compatibility but is not used in the workflow.
- Decisions applied in code on this branch (2026-10-31, second pass). See Current state.

## Current state

- Repo: `/Users/nontachai/workspace/EasySolar`, branch `main`, head `ab7339f`. Nothing committed for this slice. Not pushed.
- Uncommitted work (this slice):
  - [src/lib/server/review-repository.ts](src/lib/server/review-repository.ts): `getRevisionSpecTarget` (loads revision + existing spec for prefill), `enterRevisionSpec` (writes spec, sets state `extracted_unverified`, writes `verification_event` and `audit_event` action `revision.enter_spec`, one transaction, `FOR UPDATE`).
  - [src/app/admin/(protected)/equipment/review-actions.ts](<src/app/admin/(protected)/equipment/review-actions.ts>): `enterSpecAction`, `parseSpecForm`. Parses PV or inverter form with [src/domain/catalog/spec-schemas.ts](src/domain/catalog/spec-schemas.ts). Requires `account_admin` or `super_admin`.
  - Page: [src/app/admin/(protected)/equipment/[revisionId]/spec/page.tsx](<src/app/admin/(protected)/equipment/[revisionId]/spec/page.tsx>). Route `/admin/equipment/[revisionId]/spec`. Blocker shown if state or role does not allow entry.
  - Form: [src/components/revision-spec-form.tsx](src/components/revision-spec-form.tsx). PV: 6 critical values with pages, 3 optional. Inverter: type, 2 critical with pages, 3 optional, MPPT pages (current, range), 1 to 12 MPPT rows (add/remove by stable id).
  - Queue: [src/components/review-queue-item.tsx](src/components/review-queue-item.tsx) shows "กรอกสเปก" (draft) or "แก้ไขสเปก" (extracted_unverified) link when `canEnterSpec`.
  - [src/app/admin/(protected)/equipment/page.tsx](<src/app/admin/(protected)/equipment/page.tsx>): queue visible to `account_admin` too (`hasQueueAccess = canReview || canEnterSpec`).
  - [src/domain/catalog/review-workflow.ts](src/domain/catalog/review-workflow.ts): `revisionStateLabels` moved here (shared by queue item and spec page).
  - [src/app/globals.css](src/app/globals.css): `.spec-*` styles appended. Reuses `.admin-sku-form`. Breakpoints 900 and 620 px.
- Not in the diff, pre-existing: `AGENTS.md` (auto-written by `next dev`, do not commit with this work unless intended), and `docs/codex-operating-rules.md` (untracked).
- Verified:
  - `npm run typecheck`: pass.
  - `npm run lint`: pass.
  - `npm test`: 57 of 57 pass (10 files).
  - `npm run build`: pass. Route `/admin/equipment/[revisionId]/spec` is in the output.
- Not verified:
  - Browser check at 390, 768, 1440 px for `/admin/equipment`, the spec page, and the queue. Needs admin login and Supabase. Local `.env.local` has only `VERCEL_OIDC_TOKEN`, so local dev cannot reach the DB.
  - Real DB write path (`enterRevisionSpec`) and the audit/verification rows. No test covers it (needs DB).
  - `enterSpecAction` parse path has no unit test. `parseSpecForm` is not exported.

## Open items, in priority order

1. **Recall for admins.** `recall` now includes `account_admin` (product owner said admin does all). The migration comment `20261031000200_datasheet_review_workflow.sql` still says "recall (Super Admin only)". Update that comment or the role matrix so they agree.
2. **Self-verify is unverified in a real DB.** Verify the `selfVerified: true` row in `verification_event.new_value` and the `FOUR_EYES_REQUIRED` message with no reason. Write-path test is still open (item 4).
3. **Browser check 390 / 768 / 1440 px** (AGENTS.md rule) for `/admin/equipment` (queue + upload panel), `/admin/equipment/[id]/spec` (PV and inverter with 1 and 3 MPPT rows), and the sidebar. Check: no horizontal scroll (`document.documentElement.scrollWidth <= clientWidth`), 24 px minimum targets, visible focus. Use DOM checks first; at most 3 screenshots, outside the repo.
4. **Exercise the write path on a preview or with a test revision.** Enter a PV spec and an inverter spec with 2 MPPT rows. Check `datasheet_revision.state`, `spec_entered_by`, `spec_source_pages`, `pv_module_spec` or `inverter_spec` + `mppt_tracker`, and `verification_event` / `audit_event` rows. Then re-enter from `extracted_unverified` and confirm old tracker rows are replaced.
5. **Add tests.** Export `parseSpecForm` (or move it into `src/domain/catalog/`) and test: PV valid, PV Vmp >= Voc rejected, inverter with 0 trackers rejected, tracker rows in order, missing category rejected.
6. **Known behavior to decide on:**
   - A blank `sourceUrl` keeps the old URL (`COALESCE`). There is no way to clear it through the form.
   - Re-entry deletes and re-inserts spec rows. Only allowed in `draft` and `extracted_unverified`, so published rows are never touched.
   - `review_note` is cleared on re-entry.
7. **Commit and deploy** only when the user asks. Commit the feature files, not `AGENTS.md`. Pushing `main` deploys production (see guardrails).

## How to test locally

- `npm run typecheck && npm run lint && npm test && npm run build` (quiet; quote failing lines only).
- For the browser check, get Preview env values with `vercel env pull` (Preview has `DATABASE_POOL_MAX=1`) or use a seeded revision on Preview after the user approves a deploy.

## Guardrails

- Do not send real emails or invites. Do not publish or recall real revisions without the user's say-so.
- Do not put `SUPABASE_SERVICE_ROLE_KEY` or DB URLs in `NEXT_PUBLIC_*`, client code, or chat.
- Do not push `main` or run DB migrations without explicit approval. Pushing deploys production.
- Read the Next.js guide in `node_modules/next/dist/docs/` before writing Next.js code (Next 16.4.3, `params` is a Promise).
- Commits: use the repo's Conventional Commit style (e.g. `feat(review): add enter_spec form and action`).

## Related docs

- [docs/handoff-codex-admin-invite.md](docs/handoff-codex-admin-invite.md): invite flow and production auth setup.
- [docs/codex-operating-rules.md](docs/codex-operating-rules.md): token budget and thread hygiene.
