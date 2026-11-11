# Research axes
Objective: replace the 10 mock categories with the 4 real research axes from `Ejes/`, one page section per axis, PDFs viewable in-page with the title under each PDF.
Branch: feat/research-axes · Delivery: ask-on-risk · Tests: Python Playwright via webapp-testing `with_server.py` + `node scripts/dev-e2e.mjs`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## Specs
- S1. (rewritten by L7) "abajo 4 botones de cada uno de los ejes, al dar click a cada uno de los ejes me despliegue los respectivos pdf" — the home page shows 4 axis buttons; each opens a dedicated page `/eje/eje-N` listing that axis's PDFs.
- S2. "en esa sección subir esos pdf para que se puedan ver en la misma página" — every PDF in `Ejes/<axis>/` is published and opens in the in-page viewer; also downloadable.
- S3. "abajo de cada PDF esté el título del mismo" — each card shows the PDF preview with its title below it.
- S4. (L2, rewrites L1's "no usemos los nombres de los archivos") "dejemos esos títulos pero quitémosles los caracteres" — titles come from file names cleaned of numbering prefixes, underscores, extra spaces and `.pdf`; accents restored from PDF metadata when it matches; the 2 names truncated by Windows are completed with the title printed on the poster.
- S5. (L3) "Reemplazarlas por los ejes" — the 10 mock categories and 31 mock posters are removed.
- S6. (L7) Home page text, verbatim: "Investigación en Fisioterapia en Acción." as heading, then "Explora las propuestas de innovación, emprendimiento, podcasts, cartillas y pósters científicos de nuestros estudiantes. Conoce los proyectos organizados en nuestros cuatro ejes: Innovación y Tecnología, Discapacidad y Procesos, Actividad Física y Salud, y Desarrollo del Movimiento Humano."
- S7. (L7) "abajo de ese texto poner el video que adjunté en la carpeta video" — `Video/Introducción.mp4` published as `public/video/introduccion.mp4` and played in-page below the text, above the axis buttons.
- S8. (L7) "con botones de poder regresar a la página principal y navegar por toda la página en general" — every axis page has "Volver al inicio", breadcrumbs, previous/next axis and links to all axes; header, drawer and footer navigate the whole site.
- Assumption: search, assistant (RAG) and access gate keep working over the new content; image-only PDFs contribute only their title to the assistant (no OCR).

## Tasks
| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S2, S4, S5 | inline | done | 133c4c3 |
| T2 | S1, S2, S3 | inline | done | 1c9a7dd, bb128de |
| T3 | S2 | inline | done | ab00f93 |
| T4 | S1–S5 | inline | done | ab44615, 0bc64a8 |
| T5 | S1, S2, S3, S8 | delegated (context backstop) | done | b98bcb4, e77404e |
| T6 | S6, S7 | delegated (context backstop) | done | 4505dc0 |
| T7 | S1, S8 | delegated (context backstop) | done | 7c78233 |
| T8 | S1–S8 | delegated (context backstop) | done | e77404e, 31a1190 |

## Log
- L1 (2026-11-10, user, verbatim): "Acabo de agregar una carpeta que se llama ejes, con 4 sub carpetas, son 4 ejes en totales, por lo que necesito adicionar a la página 4 secciones, cada una para cada uno de los ejes y en esa sección subir esos pdf para que se puedan ver en la misma página, para este caso necesito que abajo de cada PDF esté el título del mismo, no usemos los nombres de los archivos que están mal, sino los que tiene cada PDF"
- L2 (2026-11-10, user, verbatim): "Veo que los nombres sí son los que corresponden a los póster, dejemos esos títulos pero quitémosles los caracteres"
- L3 (2026-11-10, user choice): "Reemplazarlas por los ejes (Recommended)"
- L4: Inventory: 53 PDFs (51 MB): Eje 1 = 25 (24 image-only with metadata titles), Eje 2 = 13, Eje 3 = 12, Eje 4 = 3. Truncated names completed from poster text: "Adaptaciones cardiovasculares inducidas por la actividad física y el ejercicio: beneficios, recomendaciones y prevención del riesgo cardiovascular"; "EFECTOS DE LA REHABILITACIÓN CARDÍACA BASADA EN EJERCICIO FÍSICO SOBRE LA CAPACIDAD FUNCIONAL EN PERSONAS ADULTAS CON INSUFICIENCIA CARDÍACA". Windows-replaced colons ("X- Y") are restored to "X: Y".
- L5 (verification): tsc and lint clean; `npm run build` ok (routes /, /_not-found, /acceso, /api/access). e2e_axes 73 PASS, e2e_assistant 38 PASS, e2e_auth 0 failures, all against `node scripts/dev-e2e.mjs`. RAG index rebuilt: 272 chunks.
- L6 (decision): thumbnails use next/image `unoptimized` because `/_next/image` is excluded from the access proxy matcher and the WebP is already 480px; `selectCategory` now scrolls to `#eje-N` and sets the hash.
- L7 (2026-11-10, user, verbatim): "No está mal, hagamos un cambio, en la página principal debemos poner el siguiente texto: \"Investigación en Fisioterapia en Acción. Explora las propuestas de innovación, emprendimiento, podcasts, cartillas y pósters científicos de nuestros estudiantes. Conoce los proyectos organizados en nuestros cuatro ejes: Innovación y Tecnología, Discapacidad y Procesos, Actividad Física y Salud, y Desarrollo del Movimiento Humano.\" abajo de ese texto poner el video que adjunté en la carpeta video, finalmente abajo 4 botones de cada uno de los ejes, al dar click a cada uno de los ejes me despliegue los respectivos pdf con botones de poder regresar a la página principal y navegar por toda la página en general"
- L8: Plan approved: shared route-group layout `src/app/(site)/layout.tsx`, home `(site)/page.tsx` (intro + video + 4 axis buttons), axis pages `(site)/eje/[slug]` (static params). Video is H.264/AAC, 18 MB, copied to `public/video/introduccion.mp4`; `Video/` gitignored. Tasks: T5 layout + axis page, T6 home, T7 assistant/RAG navigation, T8 tests + docs.
- L9 (verification, T5-T8): tsc, lint and `npm run build` clean (routes `/`, `/eje/[slug]` with eje-1..eje-4 prerendered, `/acceso`, `/api/access`). e2e_axes 138 PASS, e2e_assistant 40 PASS, e2e_auth 0 failures, against `node scripts/dev-e2e.mjs`. RAG index rebuilt (274 chunks, SCRIPT_VERSION 3).
- L10 (decisions): `params` is read inside `<Suspense>` on the axis page (awaiting it outside made client navigation fail in dev with an instant-navigation error), so an unknown slug such as `/eje/eje-9` renders the not-found UI with a noindex meta but HTTP 200, not 404. Previous/next axis are disabled (not wrapped) at the ends. `with_server.py` can hang because the dev server's verbose output fills its unread stdout pipe; runs were done with the server started separately and logs redirected to a file.
