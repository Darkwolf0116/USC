# Supabase access gate
Objective: require full name + institutional email (@usc.edu.co, trusted without verification since L8) to access the site; persist registrations in Supabase.
Branch: feat/supabase-access-gate · Delivery: ask-on-risk · Tests: Python Playwright (`tests/*.py` via webapp-testing `with_server.py`), `npm run lint`, `npm run build`.

## Specs
- S1. "para poder ingresar se debe de ingresar poniendo nombre completo y correo institucional" — the whole site (page, `/posters/*`, `/rag/*`) requires an access cookie; requests without it are redirected to an access page that asks for full name and institutional email.
- S2. "solo se puede permitir correos con el dominio @usc.edu.co" — enforced in the UI (clear Spanish error), in the server route, AND in the Supabase registration function.
- S3. (rewritten by L8) "solo hagamos que el programa al identificar el usc.edu.co lo registre y le permita entrar sin verificación" — no email code: a valid name + @usc.edu.co email is registered in Supabase and access is granted immediately (access cookie set only after the registration succeeds).
- S4. "almacenar toda la información en una base de datos en este caso una hoja de cálculo" — store full name, email, first access, last access and access count in a Supabase table (viewable/exportable as a spreadsheet from the Table Editor), plus one row per access in a log table. RLS enabled; clients cannot read other people's rows.
- S5. Supabase project: URL `https://phfnqngrohmanbffppxh.supabase.co`, publishable key `sb_publishable_4yQAGMaRdWGOq91VbqnYnw_IhujBosG`, configured via env vars (`.env.local`, Vercel env), never hardcoded in source.
- S6. Signed-in users can sign out from the header.
- Assumption: the SQL migration is applied by the user in the Supabase SQL Editor (no DB credentials available). Since L8 no email templates or SMTP are needed.

## Tasks
| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S2, S4 | inline (writer delegation denied by permission classifier) | done | a8d5bf8 |
| T2 | S1, S3, S5, S6 | inline (writer delegation denied by permission classifier) | done | 1b1ac40 |
| T3 | S1–S6 | independent verifier (Risk item 2: auth/guards) | done: S1–S6 met; 1 blocker fixed | 57e9166 |
| T4 | S2, S3, S4 | inline | done | 219cfc6 |
| T5 | S1, S2, S3, S6 | inline | done | b1bcf6c |
| T6 | S1–S6 | independent verifier (Risk item 2: guards) | done: S1–S6 met, no blockers | b1bcf6c |

## Log
- L1 (2026-11-09, user, verbatim): "Necesito que me ayudes a vincular un proyecto en supabase y le pongamos una restricción a la página, en este caso para poder ingresar se debe de ingresar poniendo nombre completo y correo institucional, solo se puede permitir correos con el dominio @usc.edu.co y almacenar toda la información en una base de datos en este caso una hoja de cálculo, las credenciales de supabase son las siguientes: https://phfnqngrohmanbffppxh.supabase.co · sb_publishable_4yQAGMaRdWGOq91VbqnYnw_IhujBosG"
- L2 (2026-11-09, user choice): "Supabase + código al correo (Recommended)" over "Supabase sin verificación" and "Google Sheets".
- L3: Supabase `/auth/v1/settings` reachable: email provider on, signup enabled, mailer_autoconfirm false.
- L4: Writer delegation and writing `.env*` files were denied by permissions; work done inline. `.env.local` must be created by the user (template in README). No test auth bypass was added.
- L5 (evidence): `npm run lint` clean, `npx tsc --noEmit` clean, `npm run build` OK (`/`, `/acceso` static, Proxy compiled), `tests/e2e_auth.py` 26/26 PASS against a fake Supabase project with mocked endpoints. Catalog/assistant e2e suites now require a real session (documented).
- L6 (verifier): S1–S6 met. Blocker: open redirect via `next=/%09/evil.com` (browsers strip tab/newline). Fixed in 57e9166 with control-character + same-origin URL check; also proxy redirect now keeps `next` queries, and SQL revokes all table privileges before granting select. Recheck: tsc + lint clean, `tests/e2e_auth.py` 0 failures incl. `%09`, `%0A`, `\` regressions; build OK.
- L7: Pending user actions: create `.env.local`, run the SQL migration, edit email templates to `{{ .Token }}`, configure custom SMTP, set Vercel env vars. Push/merge not done (user decision).
- L8 (2026-11-09, user, verbatim): "Cambio de planes, se complicó lo del dominio porque necesito los DNS de la universidad, solo hagamos que el programa al identificar el usc.edu.co lo registre y le permita entrar sin verificación, ya es tener fé que van a escribir bien el correo"
- L9: Design for L8: new migration `register_visit(p_full_name, p_email, p_user_agent) returns uuid` (security definer, granted to anon, validates name + domain, upsert by email, logs visit) replacing the auth-based schema; `POST /api/access` route validates, calls the RPC server-side and only then sets an httpOnly `usc_access` cookie (visitor uuid, 30 days) plus a readable first-name cookie; `DELETE /api/access` clears them; proxy checks the cookie. Trust-based by design: anyone can type any @usc.edu.co address or forge the cookie. `@supabase/ssr` and OTP UI removed. Tasks reopened: T4 (DB), T5 (app), T6 (verify).
- L10 (evidence): tsc + lint clean; build OK (/ and /acceso static, /api/access dynamic, Proxy); e2e_auth 62/62, e2e_catalog all checks passed (first run hit a cold-compile goto timeout, rerun green), e2e_assistant 0 failures, all against the local fake Supabase in scripts/dev-e2e.mjs.
- L11 (verifier T6): S1-S6 met, no change-caused blockers. Advisories accepted by design: cookie check is format-only; anyone with the publishable key can call register_visit directly (overwrite a known email's name, bump counts, flood visit_logs; no rate limit).
- L12: Pending user: create .env.local, run 20261109010000_open_access_registry.sql, Vercel env vars. Push/merge not done.
