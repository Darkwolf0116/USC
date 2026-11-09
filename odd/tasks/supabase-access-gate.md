# Supabase access gate
Objective: require full name + verified institutional email (@usc.edu.co, OTP code) to access the site; persist registrations in Supabase.
Branch: feat/supabase-access-gate · Delivery: ask-on-risk · Tests: Python Playwright (`tests/*.py` via webapp-testing `with_server.py`), `npm run lint`, `npm run build`.

## Specs
- S1. "para poder ingresar se debe de ingresar poniendo nombre completo y correo institucional" — the whole site (page, `/posters/*`, `/rag/*`) requires an authenticated session; unauthenticated requests are redirected to an access page that asks for full name and institutional email.
- S2. "solo se puede permitir correos con el dominio @usc.edu.co" — enforced in the UI (clear Spanish error) AND server-side in Supabase (signup of any other domain is rejected by the database).
- S3. User decision (L2): "Supabase + código al correo" — Supabase Auth email OTP: a 6-digit code is sent to the email; access is granted only after verifying it.
- S4. "almacenar toda la información en una base de datos en este caso una hoja de cálculo" — store full name, email, first access, last access and access count in a Supabase table (viewable/exportable as a spreadsheet from the Table Editor), plus one row per access in a log table. RLS enabled; clients cannot read other people's rows.
- S5. Supabase project: URL `https://phfnqngrohmanbffppxh.supabase.co`, publishable key `sb_publishable_4yQAGMaRdWGOq91VbqnYnw_IhujBosG`, configured via env vars (`.env.local`, Vercel env), never hardcoded in source.
- S6. Signed-in users can sign out from the header.
- Assumption: the SQL migration is applied by the user in the Supabase SQL Editor (no DB credentials available); the email template must include `{{ .Token }}`; custom SMTP is recommended for volume.

## Tasks
| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S2, S4 | inline (writer delegation denied by permission classifier) | done | a8d5bf8 |
| T2 | S1, S3, S5, S6 | inline (writer delegation denied by permission classifier) | done | 1b1ac40 |
| T3 | S1–S6 | independent verifier (Risk item 2: auth/guards) | done: S1–S6 met; 1 blocker fixed | 57e9166 |

## Log
- L1 (2026-11-09, user, verbatim): "Necesito que me ayudes a vincular un proyecto en supabase y le pongamos una restricción a la página, en este caso para poder ingresar se debe de ingresar poniendo nombre completo y correo institucional, solo se puede permitir correos con el dominio @usc.edu.co y almacenar toda la información en una base de datos en este caso una hoja de cálculo, las credenciales de supabase son las siguientes: https://phfnqngrohmanbffppxh.supabase.co · sb_publishable_4yQAGMaRdWGOq91VbqnYnw_IhujBosG"
- L2 (2026-11-09, user choice): "Supabase + código al correo (Recommended)" over "Supabase sin verificación" and "Google Sheets".
- L3: Supabase `/auth/v1/settings` reachable: email provider on, signup enabled, mailer_autoconfirm false.
- L4: Writer delegation and writing `.env*` files were denied by permissions; work done inline. `.env.local` must be created by the user (template in README). No test auth bypass was added.
- L5 (evidence): `npm run lint` clean, `npx tsc --noEmit` clean, `npm run build` OK (`/`, `/acceso` static, Proxy compiled), `tests/e2e_auth.py` 26/26 PASS against a fake Supabase project with mocked endpoints. Catalog/assistant e2e suites now require a real session (documented).
- L6 (verifier): S1–S6 met. Blocker: open redirect via `next=/%09/evil.com` (browsers strip tab/newline). Fixed in 57e9166 with control-character + same-origin URL check; also proxy redirect now keeps `next` queries, and SQL revokes all table privileges before granting select. Recheck: tsc + lint clean, `tests/e2e_auth.py` 0 failures incl. `%09`, `%0A`, `\` regressions; build OK.
- L7: Pending user actions: create `.env.local`, run the SQL migration, edit email templates to `{{ .Token }}`, configure custom SMTP, set Vercel env vars. Push/merge not done (user decision).
