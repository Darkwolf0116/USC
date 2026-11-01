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
npm run build      # compilación de producción
npm run lint
npm run posters    # regenera los PDF de ejemplo en public/posters
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
  lib/                  búsqueda sin tildes, bloqueo de scroll
  styles/               tokens, base y componentes
public/
  Info/logo.png         logotipo institucional (en minúsculas, Vercel distingue mayúsculas)
  posters/              PDF de cada póster
  pdfjs/standard_fonts  fuentes que PDF.js necesita para los PDF de ejemplo
scripts/                generador de pósteres y copia de recursos de PDF.js
tests/e2e_catalog.py    pruebas end-to-end con Playwright
DESIGN.md               sistema de diseño
```

## Reemplazar los PDF de ejemplo por pósteres reales

1. Copie el PDF real en `public/posters/`, por ejemplo `public/posters/mi-poster.pdf`.
2. Edite `src/data/catalog.json`: dentro de la categoría correspondiente cambie o agregue el póster y apunte `pdf` al archivo (`"/posters/mi-poster.pdf"`). Campos: `slug`, `title`, `students`, `advisor`, `semester`, `summary`, `pdf` y `thumbnail` (opcional).
3. Opcional: agregue una imagen en `public/` y use su ruta en `thumbnail` (por ejemplo `"/posters/mi-poster.png"`). Si no hay miniatura, el sitio dibuja una maqueta en CSS.
4. No ejecute `npm run posters` después de reemplazar archivos con el mismo nombre: el script sobrescribe `public/posters/<slug>.pdf` con la maqueta.

Para cambiar el logotipo, reemplace `public/Info/logo.png` conservando el nombre.

## Pruebas

```bash
python .agents/skills/webapp-testing/scripts/with_server.py --server "npm run dev" --port 3000 --timeout 120 -- python tests/e2e_catalog.py
```

Verifica pestañas, URL, búsqueda, visor de PDF, descargas, respaldo del logotipo y capturas en 375x812 y 1280x800 (se guardan en `tests/screenshots/`, ignorada por git).

## Despliegue en Vercel

1. Suba el repositorio a GitHub, GitLab o Bitbucket.
2. En Vercel elija **Add New > Project** e importe el repositorio.
3. Deje la configuración por defecto (Next.js, sin variables obligatorias) y despliegue.

Variable opcional: `NEXT_PUBLIC_REPO_URL` muestra en el pie de página un enlace al repositorio del proyecto.
