# Host login and private archive

1. Create the owner in Supabase Authentication > Users and disable new signups.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and server-only `KIMQUIZAK_OWNER_USER_ID` in `.env` and Vercel Production. The last value is the user's UUID. Never use a service-role key in browser configuration.
3. Open Supabase SQL Editor > New query. Run `supabase/migrations/202610110001_private_quiz_archive.sql`, then execute the owner enrollment statement at the bottom with your UUID. The local ignored `private/supabase-setup.sql`, when supplied, combines both steps with the configured UUID.
4. Run `supabase/migrations/202610110002_owner_delete_quiz.sql` in the SQL Editor to enable owner-only deletion (also required for existing installations).
5. Restart the local app and visit `/login`. Sign in with the app user's email and password. `/account` offers private snapshot saves, downloads, and Open in editor. Opening a saved copy asks for confirmation before replacing the browser’s teams, questions, settings, scores, and progress, then reloads the editor. Save the current quiz first to keep it. Downloaded copies can still be restored through Upload backup.
6. Before publishing, verify login, save, download, sign out, and blocked anonymous access to `/api/quizzes` and `/api/maps/config`. Use a separate browser profile to confirm visitors see only their own local data. Deploy only when ready; local edits are not published automatically.

## Access boundaries

Every archive endpoint, the account page, and the Maps configuration endpoint verifies the current user with Supabase Auth and compares the UUID against the server configuration. Unconfigured deployments fail closed for these features. Public local editing and demo play remain available. There is no signup page.

The archive uses the publishable client with the user's session. Database RLS independently requires membership in a private owner allowlist and matching `owner_id`; other authenticated users cannot read, insert, or delete snapshots. Anonymous roles have no table privileges. After applying the delete migration, enrolled owners can permanently delete their own snapshots from the Host page. Each deletion requires confirmation and leaves browser-local quizzes and downloaded files intact. Browser roles cannot update snapshots or change the allowlist. Changing owners requires updating both the allowlist and the environment variable.

Saved snapshots are separate copies, not automatic synchronization. The API accepts backups up to 3 MB (including embedded media) to stay below hosting request limits, and lists the latest 100. Large quizzes still support local file backups. Quiz content and credentials are not written to application logs.

Local browser storage is separate from cloud authorization: signing out does **not** erase local quizzes, imported backups, or downloaded files. Use the local archive's Clear everything control on shared devices. Cloud data is never automatically loaded into a visitor's browser. This version does not make browser-local data an authenticated workspace.

Maps JavaScript keys are visible to the signed-in owner's browser by design. Keep Google Cloud API and referrer restrictions; login is an additional gate, not a replacement for those restrictions.

Implementation follows [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client) and [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Local validation

Production build, TypeScript, targeted ESLint, and regression tests passed. `tests/owner-browser.cjs` verifies anonymous redirects and API denials against the production build; `tests/demo-browser.cjs` verifies fictional demo import/export. Owner identity and archive query behavior are covered with mocked Supabase responses in `tests/supabase-regression.cjs`. The host confirmed live password login and cloud saves locally. Both migrations are applied and live RLS/grant metadata was inspected; production smoke tests and live negative-user behavior remain to be verified. Nothing has been pushed or deployed during this setup.

Owner deletion is covered by mocked API tests for authentication, origin checks, UUID validation, owner-scoped deletion, missing rows, and database errors. The delete migration is applied; no existing cloud quizzes were deleted during implementation.

## CLI migration workflow

The repository is linked locally to the Supabase project. CLI login credentials stay outside Git, and `supabase/.temp/` and `.branches/` are ignored. From the project directory:

```bash
npx supabase migration list --linked
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

The initial dashboard-applied migration was inspected and recorded with `migration repair --status applied`; future changes should use migration files and `db push` so history stays synchronized. Do not re-run the original SQL setup as an upgrade: it resets table grants. On another machine, authenticate with `npx supabase login` and link the intended project with `npx supabase link --project-ref YOUR_PROJECT_REF` first. These commands update the database independently of Git pushes or Vercel deployments.

CLI setup verification: both local migrations now match remote history. The owner-delete migration was applied through `db push`. A live metadata query confirmed RLS enabled, no DELETE privilege for anonymous users, and a DELETE policy requiring owner allowlist membership plus matching `owner_id`. No saved quizzes were deleted by this verification.
