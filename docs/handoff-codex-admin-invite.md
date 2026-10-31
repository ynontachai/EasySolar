# Handoff: Admin invite flow and production auth setup

Written for: Codex (or any engineer) picking up the EasySolar admin invite work on `main`.

## Current state

- Repo: `/Users/nontachai/workspace/EasySolar`, branch `main`, head `6ed66ae`, pushed to `origin/main`.
- Commits added in this work:
  - `52c0634` feat(admin): send Super Admin invitation emails
  - `6ed66ae` perf(platform): pin functions to sin1 and cut admin auth queries
- Production: `https://easy-solar-one.vercel.app` (Vercel project `easy-solar`, team `giss-1`).
- Vercel is Git-connected. Pushing `main` triggers a Production build automatically. A push during this session did trigger one.
- Verified: `npm run typecheck`, `npm run lint`, `npm test` (29 tests), `npm run build`.
- Not verified: end-to-end invite email on production. Browser checks at 390 / 768 / 1440 px (required by `AGENTS.md`) were not run for the new `/admin/users` page.

## What the invite flow does

Route: `/admin/users` (sidebar item "ผู้ใช้และคำเชิญ", shown only to Super Admin).

1. Super Admin fills email, optional display name, role (`account_admin` or `reviewer`), and organization.
2. `inviteUserByEmail` runs server-side in [src/app/admin/(protected)/users/actions.ts](src/app/admin/(protected)/users/actions.ts), using the service-role client in [src/lib/supabase/admin.ts](src/lib/supabase/admin.ts).
3. `recordInvitation` in [src/lib/server/user-invitation-repository.ts](src/lib/server/user-invitation-repository.ts) runs one transaction that writes `user_profile`, `organization_member`, `role_assignment`, and `audit_event` (action `user.invited`).
4. If step 3 fails, the action deletes the new auth user so a retry works. If that delete also fails, it only logs.
5. The invitee gets an email. The link goes to `/auth/confirm` with `token_hash`. GET only shows a confirm button, because email scanners (Outlook Safe Links) would otherwise consume the single-use token. POST verifies the token and redirects to `/admin/set-password`. Failures redirect to `/admin/login?error=invite-link` (or `reset-link`), which shows a message. The verify error code is logged without the token. See [src/app/auth/confirm/route.ts](src/app/auth/confirm/route.ts).

Schema: [src/domain/identity/invite-schemas.ts](src/domain/identity/invite-schemas.ts). Super Admin cannot be invited from this form on purpose. Assigning Super Admin needs step-up auth, which is not built.

UI: [src/app/admin/(protected)/users/page.tsx](src/app/admin/(protected)/users/page.tsx), [src/components/admin-invite-form.tsx](src/components/admin-invite-form.tsx), styles appended to the end of [src/app/globals.css](src/app/globals.css).

## Performance change

- [vercel.json](vercel.json) sets `"regions": ["sin1"]`. Supabase project is `ap-southeast-1` (Singapore). Before, functions ran in `iad1`.
- [src/lib/server/admin-auth.ts](src/lib/server/admin-auth.ts) `getAdminPrincipal` loads profile and roles in one query. It inserts `user_profile` only if the row is missing, then re-queries.
- Vercel Production env `DATABASE_POOL_MAX=5` was added. Before, Production used the default `1`, so queries queued.
- Measured from a local machine (not a browser), after deploy:
  - `/api/health`: about 380 ms before, about 140 ms after.
  - `/admin/login`: about 770 ms before, about 180 ms after.
- The admin dashboard and `/admin/users` were not re-measured.

## Supabase setup (dashboard, not in code)

- Project ref `vaalsrnkiluepgzgifnb`, region `ap-southeast-1`.
- Site URL: `https://easy-solar-one.vercel.app`.
- Redirect URLs: `https://easy-solar-one.vercel.app/**` and `http://localhost:3000/**`.
- Email template "Invite user" link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/admin/set-password`. Saved.
- Email template "Reset password" link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/admin/set-password`. Saved.
- Custom SMTP was toggled on for sender `nontachai.y@gmail.com` through Gmail. Host `smtp.gmail.com`, port 465. The password is a Google App Password. Not confirmed saved. The Source editor only became editable after custom SMTP was set up.
- Public sign-up should be off. Not re-checked in this session.

## Vercel env (Production)

- Present: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_POSTGRES_URL` (the app reads this as a fallback for `DATABASE_URL`), `NEXT_PUBLIC_SITE_URL=https://easy-solar-one.vercel.app`, `DATABASE_POOL_MAX=5`.
- `NEXT_PUBLIC_*` values are inlined at build time. Changing them needs a new build.
- Preview has `DATABASE_POOL_MAX=1`. Development scope has no Vercel env vars, so `vercel env pull` gives nothing for Development.
- Local `.env.local` contains only `VERCEL_OIDC_TOKEN`. Local dev cannot reach Supabase without more values.

## Accounts

- Super Admin: `nontachai.y@gmail.com` (role `super_admin`, set by [supabase/migrations/20261030000100_bootstrap_super_admin.sql](supabase/migrations/20261030000100_bootstrap_super_admin.sql)). Password reset via recovery worked. `/admin` shows "Super Admin".

## Open items, in priority order

1. Test the invite on production (a fresh invite was sent after the confirm fix; the user reported it likely works, not yet fully confirmed): sign in as Super Admin, invite a mailbox the team controls, accept the link, set a password, confirm role and organization on `/admin`, and confirm the `audit_event` row. Do this before real invites.
2. Re-measure `/admin` and `/admin/users` latency after the single-query change.
3. Browser check at 390 / 768 / 1440 px for `/admin/users`, the sidebar, and the invite form, with no horizontal overflow and 24px minimum targets (per `AGENTS.md`).
4. Confirm the Gmail App Password is saved in Supabase SMTP settings. Watch Gmail daily send limits. Move to a transactional SMTP provider before real use.
5. Not built: suspend or reactivate users, resend invite, list pending invites with expiry, step-up auth for Super Admin assignment.
6. Security: recovery session tokens were pasted into chat during setup. Sign out or reset the password for `nontachai.y@gmail.com` to invalidate those sessions. Not confirmed done.

## Guardrails

- Do not put `SUPABASE_SERVICE_ROLE_KEY` or other secrets in `NEXT_PUBLIC_*`, client code, or chat.
- Do not send real invites or emails to addresses the team does not control.
- Pushing `main` deploys to production. Confirm first.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code (`AGENTS.md`). The Next.js version has breaking changes.
- Tests and checks: `npm run typecheck && npm run lint && npm test && npm run build`.
