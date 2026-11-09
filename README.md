# Repositorio de Proyectos de Aula - Fisioterapia USC

Sitio de una sola página para la muestra académica del Programa de Fisioterapia de la Universidad Santiago de Cali. Reúne pósteres de proyectos de aula en 10 categorías, con búsqueda en vivo, visor de PDF dentro de la página y descarga directa.

> **Mockup académico.** Los nombres de estudiantes y docentes, los títulos y los pósteres en PDF son ilustrativos. No corresponden a personas ni trabajos reales.

Construido con Next.js 16 (App Router), React 19, Tailwind CSS v4, `react-pdf` y `lucide-react`.

## Requisitos

- Node.js 22.13 o superior (requisito de `react-pdf`).
- Python 3 con Playwright solo si va a ejecutar las pruebas end-to-end.

## Uso

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # compilación de producción (regenera antes el índice del asistente)
npm run lint
npm run posters    # regenera los PDF de ejemplo en public/posters
npm run rag:index  # regenera el índice del asistente virtual (public/rag)
```

El enlace `?categoria=<slug>` abre una categoría concreta, por ejemplo `/?categoria=practica-infancia#categorias`.

## Estructura

```
src/
  app/                  layout, página y estilos globales
  components/
    catalog/            proveedor de estado, pestañas, tarjetas, búsqueda
    layout/             encabezado, hero, pie de página, logotipo
    pdf-viewer/         visor compuesto (Root, Header, Toolbar, Document) y diálogo
  data/                 catalog.json (datos), catalog.ts y types.ts
  components/assistant/ asistente virtual: proveedor, lanzador y panel compuesto
  lib/                  búsqueda sin tildes, bloqueo de scroll
  lib/rag/              recuperación (BM25 + vectores), intenciones, prompt, modelos
  workers/              Web Workers del asistente (embeddings y modelo de lenguaje)
  styles/               tokens, base y componentes
public/
  Info/logo.png         logotipo institucional (en minúsculas, Vercel distingue mayúsculas)
  posters/              PDF de cada póster
  rag/                  índice del asistente (index.json + vectors.bin), generado
  pdfjs/standard_fonts  fuentes que PDF.js necesita para los PDF de ejemplo
scripts/                generador de pósteres, copia de recursos de PDF.js e indexador del asistente
tests/                  pruebas end-to-end con Playwright (catálogo y asistente)
DESIGN.md               sistema de diseño
```

## Reemplazar los PDF de ejemplo por pósteres reales

1. Copie el PDF real en `public/posters/`, por ejemplo `public/posters/mi-poster.pdf`.
2. Edite `src/data/catalog.json`: dentro de la categoría correspondiente cambie o agregue el póster y apunte `pdf` al archivo (`"/posters/mi-poster.pdf"`). Campos: `slug`, `title`, `students`, `advisor`, `semester`, `summary`, `pdf` y `thumbnail` (opcional).
3. Opcional: agregue una imagen en `public/` y use su ruta en `thumbnail` (por ejemplo `"/posters/mi-poster.png"`). Si no hay miniatura, el sitio dibuja una maqueta en CSS.
4. No ejecute `npm run posters` después de reemplazar archivos con el mismo nombre: el script sobrescribe `public/posters/<slug>.pdf` con la maqueta.
5. Suba los cambios (`git push`). Vercel ejecuta `prebuild` y el asistente aprende los PDF nuevos sin más pasos. En local use `npm run rag:index` y confirme los archivos de `public/rag/`.

Para cambiar el logotipo, reemplace `public/Info/logo.png` conservando el nombre.

## Asistente virtual (IA local)

Un botón flotante abre un asistente que responde preguntas sobre los pósteres, cita sus fuentes ([1], [2]…), lleva al visitante a una categoría y abre PDF. **No usa ningún servidor de IA ni clave de API**: el modelo de lenguaje se ejecuta en el navegador de cada visitante, por lo que no genera costo por consulta.

### Cómo funciona

```
Build (Vercel o local)                      Navegador del visitante
----------------------                      -----------------------
public/posters/*.pdf  ─┐                    pregunta ─> router de intenciones ─> acción (ir / abrir / buscar)
src/data/catalog.json ─┼─ rag:index ─┐          │ (no es un comando)
páginas de ayuda      ─┘  (prebuild)  │          v
                                      v      BM25 (MiniSearch) + vectores (e5-small, WASM, Web Worker)
              public/rag/index.json + vectors.bin   └─ fusión RRF ─> 5 fuentes
                                                          │
                          con WebGPU + consentimiento ────┤──── sin WebGPU o sin descarga
                          WebLLM (Qwen2.5, Web Worker)    │      "modo búsqueda": fragmentos
                          respuesta en streaming + [n]    v      con términos marcados
```

- `scripts/build-rag-index.mjs` extrae el texto de cada PDF por página (PDF.js), añade una ficha por póster y por categoría y textos de ayuda del sitio, los divide en fragmentos de unos 650 caracteres y calcula embeddings con `Xenova/multilingual-e5-small`. Si nada cambió (hash del catálogo, los PDF y la versión del script) no hace nada; `npm run rag:index -- --force` fuerza la regeneración. El modelo se guarda en caché en `.cache/` (ignorada por git).
- El asistente solo carga el índice (~200 KB) al abrirse. Los modelos pesados se cargan **bajo demanda**, en Web Workers, y no forman parte del JavaScript inicial de la página.

### Requisitos y primera descarga

- Navegador con **WebGPU**: Chrome o Edge 113+ en escritorio y Android reciente; Safari 26+. En Firefox o sin tarjeta gráfica compatible, el asistente funciona en **modo búsqueda** (búsqueda por palabras clave, sin redacción).
- Al pulsar *Activar IA local* el visitante acepta una descarga única: **≈ 1 GB** con el modelo *Equilibrado* (`Qwen2.5-1.5B-Instruct-q4f16_1-MLC`, 880 MB + 118 MB del modelo de búsqueda semántica) o **≈ 0,4 GB** con el *Ligero* (`Qwen2.5-0.5B-Instruct-q4f16_1-MLC`, 290 MB). Los archivos quedan en la caché del navegador; en visitas posteriores se cargan solos si el visitante ya aceptó (se recuerda en `localStorage`). Los tamaños son aproximados y se declaran en `src/lib/rag/models.ts`.
- Los modelos se descargan de Hugging Face y de la CDN de ONNX Runtime Web (jsDelivr); el sitio solo sirve archivos estáticos.

### Privacidad

Las preguntas se procesan en el dispositivo: no se envían a ningún servidor propio ni de terceros. Lo único que se descarga son los modelos (archivos públicos). El navegador puede borrar la caché de modelos desde la configuración del sitio.

### Limitaciones

Un modelo de 0,5 a 1,5 mil millones de parámetros puede equivocarse o ser impreciso; por eso se le exige responder solo con el contexto y citar fuentes, y siempre se muestran los fragmentos de origen. No ofrece consejos clínicos.

## Acceso con correo institucional (Supabase)

Todo el sitio (página, PDF e índice del asistente) exige registrarse. En `/acceso` la persona escribe su nombre completo y su correo `@usc.edu.co` y entra de inmediato; el correo **no se verifica**. Cada ingreso queda registrado en Supabase (tablas `visitors` y `visit_logs`), exportable a CSV/Excel.

- `POST /api/access` valida los datos, llama a la función `register_visit` de Supabase y, solo si el registro funcionó, guarda una cookie de acceso por 30 días. "Salir" la borra.
- `src/proxy.ts` revisa esa cookie en cada solicitud y redirige a `/acceso` si falta.
- El dominio se valida en el formulario, en el servidor y en la base de datos.
- Pasos en el panel de Supabase (tablas, exportar, variables): [`supabase/README.md`](supabase/README.md).

Para trabajar en local crea `.env.local` en la raíz (no se sube a git) a partir de `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://phfnqngrohmanbffppxh.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<clave sb_publishable_ del proyecto>
```

## Pruebas

Todas las pruebas usan `scripts/dev-e2e.mjs`, que levanta el sitio contra un Supabase falso local (no toca el proyecto real). Las del catálogo y del asistente se registran primero con un correo de prueba.

```bash
python .agents/skills/webapp-testing/scripts/with_server.py --server "node scripts/dev-e2e.mjs" --port 3000 --timeout 180 -- python tests/e2e_auth.py
```

```bash
python .agents/skills/webapp-testing/scripts/with_server.py --server "node scripts/dev-e2e.mjs" --port 3000 --timeout 180 -- python tests/e2e_catalog.py
```

Verifica pestañas, URL, búsqueda, visor de PDF, descargas, respaldo del logotipo y capturas en 375x812 y 1280x800 (se guardan en `tests/screenshots/`, ignorada por git).

Para el asistente (en Chromium sin WebGPU valida el modo búsqueda, las intenciones y las acciones sobre las fuentes):

```bash
python .agents/skills/webapp-testing/scripts/with_server.py --server "node scripts/dev-e2e.mjs" --port 3000 --timeout 180 -- python tests/e2e_assistant.py
```

## Despliegue en Vercel

1. Suba el repositorio a GitHub, GitLab o Bitbucket.
2. En Vercel elija **Add New > Project** e importe el repositorio.
3. Agregue las variables obligatorias `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ver [`supabase/README.md`](supabase/README.md)) y despliegue.

Variable opcional: `NEXT_PUBLIC_REPO_URL` muestra en el pie de página un enlace al repositorio del proyecto.
