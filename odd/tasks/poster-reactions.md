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

## Log
- L1 (2026-11-10, user, verbatim): "Bueno, un último cambio, es posible implementar un sistema de interacción?, en este caso me refiero a un sistema como poner likes o algún emoji que demuestre que a la gente le gustó o no el póster"
- L2 (2026-11-10, user choice): "Varias reacciones" over "Me gusta / No me gusta privado", "Me gusta / No me gusta público", "Solo Me gusta".
- L3 (2026-11-10, user, verbatim): "Adicional a las reacciones, la misión y visión del video ponlo centrado con el video"
- L4 (evidence T1): `.intro-video__title` gets `text-align: center` + `text-wrap: balance`; new check measures the rendered text center vs the video frame center (±2px); `tests/e2e_axes.py` 141 PASS.
- L5 (evidence T2): migration `20261110000000_poster_reactions.sql` (table, RLS, `set_poster_reaction`, `get_poster_reactions`, admin view); `/api/reactions` GET/POST (400/401/502/503); fake Supabase handles both RPCs. `npm run build` lists `/api/reactions`.
- L6 (evidence T3/T4): `ReactionsProvider` in `(site)/layout.tsx`, `ReactionBar` (`card` in `PosterCard`, `viewer` in the dialog). `tests/e2e_reactions.py` 48 PASS; `e2e_axes.py` 141 PASS; `e2e_assistant.py` 40 PASS; `e2e_auth.py` 62 PASS (its visit counter now ignores reaction RPCs, which the new bar triggers on every page load).
- L7 (verifier T5): S1–S3 PASS, no blockers; tsc + lint clean. Advisories: optional `security_invoker = true` on the summary view; viewer derives the axis from the poster slug (unique across all 53 today, would mis-key on a future duplicate slug). Pending user: run `supabase/migrations/20261110000000_poster_reactions.sql` in Supabase. Not pushed.
