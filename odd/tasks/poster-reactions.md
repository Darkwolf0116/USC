# Poster reactions
Objective: let visitors react to each poster with one of 4 positive emoji reactions, stored in Supabase; plus center the video title.
Branch: feat/poster-reactions · Delivery: ask-on-risk · Tests: Python Playwright (`python tests/*.py` against `node scripts/dev-e2e.mjs` started in background), `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## Specs
- S1. "es posible implementar un sistema de interacción?, en este caso me refiero a un sistema como poner likes o algún emoji que demuestre que a la gente le gustó o no el póster" + choice L2 "Varias reacciones" — each poster card and the PDF viewer show 4 reactions: ❤️ Me encanta (`love`), 👏 Aplausos (`clap`), 💡 Interesante (`insight`), ✨ Inspirador (`inspire`), each with its count.
- S2. One reaction per visitor per poster; tapping the chosen reaction removes it, tapping another switches it; it persists across reloads and devices with the same access cookie.
- S3. Reactions are stored in Supabase (`public.poster_reactions`, keyed by visitor + `eje-N/<slug>`), with an admin summary view exportable to CSV; clients cannot read or write the table directly.
- S4. (L3) "la misión y visión del video ponlo centrado con el video" — the "Misión y Visión Programa de Fisioterapia" heading is centered over the video.
- Assumption: identity is the existing trust-based `usc_access` visitor cookie; the user runs the new SQL migration in Supabase.

## Tasks
| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S4 | inline | done | be5d09c |
| T2 | S2, S3 | delegated (context backstop) | done | 28d7ca7 |
| T3 | S1, S2 | delegated (context backstop) | done | 67c09bb |
| T4 | S1–S3 | delegated (context backstop) | done | abc064f (tests), 5cd86f5 (docs) |
| T5 | S1–S3 | independent verifier (Risk items 1: new persisted data, 2: anon-callable security definer) | done: S1–S3 PASS, no blockers | 5cd86f5 |
| T6 | S2, S3 | delegated (context backstop) | done: route 401 `visitor_not_found` + cookie clear, `visitor` flag migration, visible notices, fake Supabase, tests, docs | e67e060 (fix), test commit, docs commit |
| T7 | S2, S3 | independent verifier (Risk item 2: session cookie clearing) | done: no blockers | 3f7cdae |

## Log
- L1 (2026-11-10, user, verbatim): "Bueno, un último cambio, es posible implementar un sistema de interacción?, en este caso me refiero a un sistema como poner likes o algún emoji que demuestre que a la gente le gustó o no el póster"
- L2 (2026-11-10, user choice): "Varias reacciones" over "Me gusta / No me gusta privado", "Me gusta / No me gusta público", "Solo Me gusta".
- L3 (2026-11-10, user, verbatim): "Adicional a las reacciones, la misión y visión del video ponlo centrado con el video"
- L4 (evidence T1): `.intro-video__title` gets `text-align: center` + `text-wrap: balance`; new check measures the rendered text center vs the video frame center (±2px); `tests/e2e_axes.py` 141 PASS.
- L5 (evidence T2): migration `20261110000000_poster_reactions.sql` (table, RLS, `set_poster_reaction`, `get_poster_reactions`, admin view); `/api/reactions` GET/POST (400/401/502/503); fake Supabase handles both RPCs. `npm run build` lists `/api/reactions`.
- L6 (evidence T3/T4): `ReactionsProvider` in `(site)/layout.tsx`, `ReactionBar` (`card` in `PosterCard`, `viewer` in the dialog). `tests/e2e_reactions.py` 48 PASS; `e2e_axes.py` 141 PASS; `e2e_assistant.py` 40 PASS; `e2e_auth.py` 62 PASS (its visit counter now ignores reaction RPCs, which the new bar triggers on every page load).
- L7 (verifier T5): S1–S3 PASS, no blockers; tsc + lint clean. Advisories: optional `security_invoker = true` on the summary view; viewer derives the axis from the poster slug (unique across all 53 today, would mis-key on a future duplicate slug). Pending user: run `supabase/migrations/20261110000000_poster_reactions.sql` in Supabase. Not pushed.
- L8 (2026-11-10, user, verbatim): "Ya hice new Query y me deja reaccionar pero no sale nada en supabase, la idea es que si le doy like el like quede en la página y que la gente vea que ya hay gente que le gustó la reacción"
- L9 (diagnosis): prod `get_poster_reactions(null)` returned empty counts (0 stored reactions); `set_poster_reaction` with an unknown visitor returns 23514 "Visitante no valido"; the route turned 23514 into a silent 400 and the UI only announced it in a hidden live region. Fix (T6): unknown visitor -> 401 `visitor_not_found` + both cookies cleared (only when Supabase confirms: that error, or `visitor === false`; a missing field is treated as unknown), every RPC error logged, migration `20261111000000_reactions_visitor_flag.sql` (adds `visitor`, `security_invoker` on the summary view), visible notice with "Ingresar de nuevo" and a transient visible save error. Evidence: `e2e_reactions.py` 69 PASS; `e2e_axes.py` 141, `e2e_assistant.py` 40, `e2e_auth.py` 62 PASS; tsc, lint, build clean. Pending user: run the new migration, reload the site, sign in again. Not pushed.
- L10 (verifier T7): no blockers; tsc + lint clean. Cookies are cleared only on Supabase confirmation (23514 "Visitante no valido" or GET visitor === false); deletion path matches /api/access; safeNextPath used for the re-login link. Advisories: the notice relies on the provider live region (no own role), and the viewer shows the expired notice twice by design.
