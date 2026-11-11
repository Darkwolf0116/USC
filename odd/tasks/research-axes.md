# Research axes
Objective: replace the 10 mock categories with the 4 real research axes from `Ejes/`, one page section per axis, PDFs viewable in-page with the title under each PDF.
Branch: feat/research-axes · Delivery: ask-on-risk · Tests: Python Playwright via webapp-testing `with_server.py` + `node scripts/dev-e2e.mjs`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## Specs
- S1. "necesito adicionar a la página 4 secciones, cada una para cada uno de los ejes" — one page section per axis (Eje 1–4), in order, each with its name and its PDFs.
- S2. "en esa sección subir esos pdf para que se puedan ver en la misma página" — every PDF in `Ejes/<axis>/` is published and opens in the in-page viewer; also downloadable.
- S3. "abajo de cada PDF esté el título del mismo" — each card shows the PDF preview with its title below it.
- S4. (L2, rewrites L1's "no usemos los nombres de los archivos") "dejemos esos títulos pero quitémosles los caracteres" — titles come from file names cleaned of numbering prefixes, underscores, extra spaces and `.pdf`; accents restored from PDF metadata when it matches; the 2 names truncated by Windows are completed with the title printed on the poster.
- S5. (L3) "Reemplazarlas por los ejes" — the 10 mock categories and 31 mock posters are removed.
- Assumption: search, assistant (RAG) and access gate keep working over the new content; image-only PDFs contribute only their title to the assistant (no OCR).

## Tasks
| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S2, S4, S5 | inline | in progress | |
| T2 | S1, S2, S3 | inline | pending | |
| T3 | S2 | inline | pending | |
| T4 | S1–S5 | inline | pending | |

## Log
- L1 (2026-11-10, user, verbatim): "Acabo de agregar una carpeta que se llama ejes, con 4 sub carpetas, son 4 ejes en totales, por lo que necesito adicionar a la página 4 secciones, cada una para cada uno de los ejes y en esa sección subir esos pdf para que se puedan ver en la misma página, para este caso necesito que abajo de cada PDF esté el título del mismo, no usemos los nombres de los archivos que están mal, sino los que tiene cada PDF"
- L2 (2026-11-10, user, verbatim): "Veo que los nombres sí son los que corresponden a los póster, dejemos esos títulos pero quitémosles los caracteres"
- L3 (2026-11-10, user choice): "Reemplazarlas por los ejes (Recommended)"
- L4: Inventory: 53 PDFs (51 MB): Eje 1 = 25 (24 image-only with metadata titles), Eje 2 = 13, Eje 3 = 12, Eje 4 = 3. Truncated names completed from poster text: "Adaptaciones cardiovasculares inducidas por la actividad física y el ejercicio: beneficios, recomendaciones y prevención del riesgo cardiovascular"; "EFECTOS DE LA REHABILITACIÓN CARDÍACA BASADA EN EJERCICIO FÍSICO SOBRE LA CAPACIDAD FUNCIONAL EN PERSONAS ADULTAS CON INSUFICIENCIA CARDÍACA". Windows-replaced colons ("X- Y") are restored to "X: Y".
