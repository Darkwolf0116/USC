# Poster comments
Objective: keep only the ❤️ and 👏 reactions and add a per-poster comments section, shown only after pressing a "Comentarios" button next to them, listing each comment with the signed-in visitor's name.
Branch: feat/poster-comments · Delivery: ask-on-risk · Tests: Python Playwright (`python tests/*.py` against `node scripts/dev-e2e.mjs` started in background), `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## Specs
- S1. "solo dejemos los corazones y los aplausos" — the reaction bar shows only ❤️ Me encanta (`love`) and 👏 Aplausos (`clap`); the API rejects other reactions. Existing stored rows are not deleted.
- S2. "pongámosle una sección de comentarios, que queden visibles con el nombre del usuario ingresado" — each poster has comments stored in Supabase; each comment shows the author's full name (from `public.visitors`), its date and text; never the email.
- S3. "que solo sea visibles los comentarios si oprimimos el botón de comentarios" — the comments panel is hidden by default and toggles with the button (`aria-expanded`).
- S4. "dejemos este botón al lado del corazón y los aplausos" — the "Comentarios (n)" button sits in the same row as ❤️ and 👏, on cards and in the viewer.
- Assumption: identity is the trust-based `usc_access` cookie; 1–500 characters per comment; 15 s anti-spam per visitor; moderation from the Supabase dashboard; the user runs the new migration.

## Tasks
| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S1 | delegated (context backstop) | done | f05ea06 |
| T2 | S2 | delegated (context backstop) | done | 76a410c |
| T3 | S2, S3, S4 | delegated (context backstop) | done | f5b46aa |
| T4 | S1–S4 | delegated (context backstop) | done | ca2fb59, 65c724e |
| T5 | S1–S4 | independent verifier (Risk items 1: user-generated persisted data, 2: anon-callable security definer) | pending | |

## Log
- L1 (2026-11-12, user, verbatim): "Sí era la cookie, hagamos un último cambio, solo dejemos los corazones y los aplausos, adicional pongámosle una sección de comentarios, que queden visibles con el nombre del usuario ingresado, y que solo sea visibles los comentarios si oprimimos el botón de comentarios, dejemos este botón al lado del corazón y los aplausos"
- L2: Plan approved (`C:\Users\USUARIO\.claude\plans\no-est-mal-hagamos-bright-possum.md`).
- L3 (writer evidence): tsc, lint and build clean (route table has /api/comments); e2e_reactions 72/72, e2e_comments 83/83, e2e_axes 141/141, e2e_assistant 40/40, e2e_auth 62/62 against dev-e2e (fake Supabase). Anti-spam uses custom SQLSTATE P0429 (HTTP 429). Real Supabase never contacted; migration 20261112000000 not yet run by the user.
