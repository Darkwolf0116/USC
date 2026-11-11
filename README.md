# Repositorio de Proyectos de Aula - Fisioterapia USC

Sitio para la muestra académica del Programa de Fisioterapia de la Universidad Santiago de Cali. Reúne los documentos de investigación en PDF de los cuatro ejes del programa, con una portada (texto, video de presentación y cuatro botones), una página por eje, búsqueda en vivo, visor de PDF dentro de la página y descarga directa.

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
npm run axes       # importa los PDF de Ejes/ a public/ejes y regenera src/data/catalog.json
npm run rag:index  # regenera el índice del asistente virtual (public/rag)
```

Estructura del sitio: la portada (`/`) muestra el texto de presentación, el video y cuatro botones; cada botón abre la página de su eje (`/eje/eje-1` a `/eje/eje-4`) con sus PDF. Las páginas de eje se generan solas a partir de `src/data/catalog.json`: al agregar o quitar documentos con `npm run axes` no hay que tocar código. Los enlaces antiguos `/#eje-3` y `/?categoria=eje-3` redirigen a `/eje/eje-3`.

### Reemplazar el video de la portada

El video es `public/video/introduccion.mp4` (H.264 + AAC para que reproduzca en todos los navegadores). Para cambiarlo, reemplace ese archivo conservando el nombre. La carpeta `Video/` de la raíz es solo la fuente local y está ignorada por git, igual que `Ejes/`. El video no tiene subtítulos.

## Estructura

```
src/
  app/                  layout raíz, grupo (site) con portada y /eje/[slug], acceso y API
  components/
    catalog/            proveedor de estado, tarjetas, búsqueda
    home/               introducción, video y botones de eje de la portada
    axis/               página de eje (migas, cuadrícula de PDF, navegación entre ejes)
    layout/             encabezado, pie de página, logotipo
    pdf-viewer/         visor compuesto (Root, Header, Toolbar, Document) y diálogo
  data/                 catalog.json (datos), catalog.ts y types.ts
  components/assistant/ asistente virtual: proveedor, lanzador y panel compuesto
  lib/                  búsqueda sin tildes, bloqueo de scroll
  lib/rag/              recuperación (BM25 + vectores), intenciones, prompt, modelos
  workers/              Web Workers del asistente (embeddings y modelo de lenguaje)
  styles/               tokens, base y componentes
public/
  Info/logo.png         logotipo institucional (en minúsculas, Vercel distingue mayúsculas)
  video/                video de presentación de la portada
  ejes/eje-N/           PDF de cada eje y su miniatura WebP (generados con npm run axes)
  rag/                  índice del asistente (index.json + vectors.bin), generado
  pdfjs/standard_fonts  fuentes que PDF.js necesita para los PDF de ejemplo
scripts/                importador de ejes (build-axes), copia de recursos de PDF.js e indexador del asistente
tests/                  pruebas end-to-end con Playwright (ejes, asistente y acceso)
DESIGN.md               sistema de diseño
```

## Agregar documentos a los ejes

1. Copie el PDF en la carpeta del eje dentro de `Ejes/` (por ejemplo `Ejes/Eje 3 - Actividad Física, Ejercicio y Salud/mi-documento.pdf`). `Ejes/` es la fuente local y está ignorada por git.
2. Ejecute `npm run axes`. El script copia los PDF a `public/ejes/eje-N/`, genera la miniatura WebP de la primera página, cuenta las páginas y escribe `src/data/catalog.json`. El título sale del nombre del archivo, sin numeración inicial, guiones bajos, espacios repetidos ni `.pdf`.
3. Revise los títulos en la tabla que imprime el script. Para corregir uno (por ejemplo un nombre truncado por Windows o sin tildes) agregue su entrada en `src/data/title-overrides.json` y vuelva a ejecutar `npm run axes`.
4. Ejecute `npm run rag:index` para que el asistente aprenda los documentos nuevos.
5. Confirme (`git add`) `public/ejes`, `src/data/catalog.json`, `src/data/title-overrides.json` y `public/rag`, y suba los cambios. Vercel ejecuta `prebuild` y publica.

Los PDF compuestos solo por imágenes (por ejemplo pósteres exportados como imagen) no tienen texto extraíble: no se aplica OCR, así que el asistente solo conoce su título y su eje. Los PDF con texto se indexan completos, por página.

Para cambiar el logotipo, reemplace `public/Info/logo.png` conservando el nombre.

## Asistente virtual (IA local)

Un botón flotante abre un asistente que responde preguntas sobre los documentos, cita sus fuentes ([1], [2]…), lleva al visitante a un eje y abre PDF. **No usa ningún servidor de IA ni clave de API**: el modelo de lenguaje se ejecuta en el navegador de cada visitante, por lo que no genera costo por consulta.

### Cómo funciona

```
Build (Vercel o local)                      Navegador del visitante
----------------------                      -----------------------
public/ejes/*/*.pdf  ─┐                     pregunta ─> router de intenciones ─> acción (ir / abrir / buscar)
src/data/catalog.json ─┼─ rag:index ─┐          │ (no es un comando)
páginas de ayuda      ─┘  (prebuild)  │          v
                                      v      BM25 (MiniSearch) + vectores (e5-small, WASM, Web Worker)
              public/rag/index.json + vectors.bin   └─ fusión RRF ─> 5 fuentes
                                                          │
                          con WebGPU + consentimiento ────┤──── sin WebGPU o sin descarga
                          WebLLM (Qwen2.5, Web Worker)    │      "modo búsqueda": fragmentos
                          respuesta en streaming + [n]    v      con términos marcados
```

- `scripts/build-rag-index.mjs` extrae el texto de cada PDF por página (PDF.js), añade una ficha por documento y por eje y textos de ayuda del sitio, los divide en fragmentos de unos 650 caracteres y calcula embeddings con `Xenova/multilingual-e5-small`. Si nada cambió (hash del catálogo, los PDF y la versión del script) no hace nada; `npm run rag:index -- --force` fuerza la regeneración. El modelo se guarda en caché en `.cache/` (ignorada por git).
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

## Reacciones

Cada tarjeta de póster y el visor de PDF muestran dos reacciones con su contador, ❤️ Me encanta y 👏 Aplausos, y a su lado el botón **💬 Comentarios (n)** (ver [Comentarios](#comentarios)). Las reacciones 💡 y ✨ ya no se ofrecen: la API las rechaza y las que ya estaban guardadas se conservan sin mostrarse.

- Cada persona tiene **una reacción por póster**: tocar otra la cambia y tocar la misma la quita. Se conserva al recargar y en otros dispositivos mientras se use la misma cookie de acceso.
- Se guardan en Supabase (tabla `poster_reactions`); los totales por póster se ven y exportan a CSV desde la vista `poster_reaction_summary` (pasos en [`supabase/README.md`](supabase/README.md)).
- `GET` y `POST /api/reactions` usan la cookie de acceso para identificar a la persona; el navegador nunca ve ese identificador ni toca las tablas.
- Es coherente con el acceso "de confianza": como el correo no se verifica, quien registre varios correos `@usc.edu.co` podría reaccionar más de una vez.
- Hay que ejecutar la migración `20261110000000_poster_reactions.sql` en Supabase; hasta entonces los botones quedan deshabilitados.

## Comentarios

Cada póster tiene una sección de comentarios, visible solo al tocar el botón **💬 Comentarios (n)** junto al corazón y los aplausos (en la tarjeta y en el visor de PDF).

- Cada comentario muestra el **nombre completo con el que la persona ingresó**, la fecha relativa ("hace 5 minutos", con la fecha completa al pasar el cursor) y el texto, que se muestra como texto plano y conserva los saltos de línea. Nunca se muestra el correo.
- De 1 a 500 caracteres. Se publica con **Publicar** o con Ctrl/Cmd + Enter. Para evitar spam, cada persona puede comentar una vez cada 15 segundos (la API responde 429).
- Se guardan en Supabase (tabla `poster_comments`). `GET /api/comments?poster=eje-N/<slug>` y `POST /api/comments` usan la cookie de acceso, igual que las reacciones.
- No hay edición ni borrado por parte de quien comenta: el administrador modera desde Supabase y puede exportar todo con la vista `poster_comment_export` (pasos en [`supabase/README.md`](supabase/README.md)).
- Como el acceso es "de confianza", el nombre mostrado es el que la persona escribió al ingresar: alguien podría ingresar con un nombre ajeno.
- Hay que ejecutar la migración `20261112000000_poster_comments.sql` en Supabase; hasta entonces el botón muestra 0 y publicar falla con un aviso.

## Pruebas

Todas las pruebas usan `scripts/dev-e2e.mjs`, que levanta el sitio contra un Supabase falso local (no toca el proyecto real). Las del catálogo y del asistente se registran primero con un correo de prueba.

```bash
python .agents/skills/webapp-testing/scripts/with_server.py --server "node scripts/dev-e2e.mjs" --port 3000 --timeout 180 -- python tests/e2e_auth.py
```

```bash
python .agents/skills/webapp-testing/scripts/with_server.py --server "node scripts/dev-e2e.mjs" --port 3000 --timeout 180 -- python tests/e2e_axes.py
```

Verifica la portada (texto literal, video, cuatro botones), las cuatro páginas de eje, las migas, «Volver al inicio», eje anterior/siguiente, los enlaces antiguos, los títulos bajo cada vista previa, el acceso a cada PDF y miniatura, el visor (1 y 13 páginas), el menú Ejes, los enlaces directos, la búsqueda, el respaldo del logotipo y capturas en 375x812 y 1280x800 (se guardan en `tests/screenshots/`, ignorada por git).

Para las reacciones (el Supabase falso las guarda en memoria; el script usa visitantes nuevos en cada corrida):

```bash
python .agents/skills/webapp-testing/scripts/with_server.py --server "node scripts/dev-e2e.mjs" --port 3000 --timeout 180 -- python tests/e2e_reactions.py
```

Verifica que cada tarjeta tiene exactamente dos reacciones (y la API rechaza `insight`/`inspire`), reaccionar, cambiar y quitar, la persistencia al recargar, que un segundo visitante suma a los mismos totales con su propia selección, la barra del visor sincronizada con la tarjeta, que la API rechaza datos inválidos o sin cookie sin llegar a Supabase, y el ancho de 375 px.

Para los comentarios (el Supabase falso aplica las mismas reglas que el SQL, incluida la espera de 15 s; el script borra sus visitantes al terminar):

```bash
python .agents/skills/webapp-testing/scripts/with_server.py --server "node scripts/dev-e2e.mjs" --port 3000 --timeout 180 -- python tests/e2e_comments.py
```

Verifica que el panel está oculto hasta tocar el botón (`aria-expanded`), el mensaje de panel vacío, publicar con el nombre completo de quien ingresó, el contador, la persistencia al recargar, que otro visitante ve el comentario, que `<script>` se muestra literal, el rechazo de texto vacío o de más de 500 caracteres, el antispam (429), la sincronía entre tarjeta y visor, el aviso de reingreso con una cookie vieja y el ancho de 375 px.

Para el asistente (en Chromium sin WebGPU valida el modo búsqueda, las intenciones y las acciones sobre las fuentes):

```bash
python .agents/skills/webapp-testing/scripts/with_server.py --server "node scripts/dev-e2e.mjs" --port 3000 --timeout 180 -- python tests/e2e_assistant.py
```

## Despliegue en Vercel

1. Suba el repositorio a GitHub, GitLab o Bitbucket.
2. En Vercel elija **Add New > Project** e importe el repositorio.
3. Agregue las variables obligatorias `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ver [`supabase/README.md`](supabase/README.md)) y despliegue.

Variable opcional: `NEXT_PUBLIC_REPO_URL` muestra en el pie de página un enlace al repositorio del proyecto.
