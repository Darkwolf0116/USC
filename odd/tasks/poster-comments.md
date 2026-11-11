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
| T1 | S1 | delegated (context backstop) | pending | |
| T2 | S2 | delegated (context backstop) | pending | |
| T3 | S2, S3, S4 | delegated (context backstop) | pending | |
| T4 | S1–S4 | delegated (context backstop) | pending | |
| T5 | S1–S4 | independent verifier (Risk items 1: user-generated persisted data, 2: anon-callable security definer) | pending | |

## Log
- L1 (2026-11-12, user, verbatim): "Sí era la cookie, hagamos un último cambio, solo dejemos los corazones y los aplausos, adicional pongámosle una sección de comentarios, que queden visibles con el nombre del usuario ingresado, y que solo sea visibles los comentarios si oprimimos el botón de comentarios, dejemos este botón al lado del corazón y los aplausos"
- L2: Plan approved (`C:\Users\USUARIO\.claude\plans\no-est-mal-hagamos-bright-possum.md`).
