/**
 * Builds the retrieval index used by the in-browser virtual assistant.
 *
 * Output (served as static files by Vercel):
 *   public/rag/index.json   chunk metadata + text
 *   public/rag/vectors.bin  Float32 row-major embeddings, same order as `chunks`
 *
 * Sources: every PDF in public/posters, one chunk per catalog poster / category and a few
 * hand-written site help chunks. The index is skipped when nothing changed (hash of
 * catalog.json + PDF bytes + script version). Use `--force` to rebuild anyway.
 *
 * Runs automatically before `next build` (see the "prebuild" npm script).
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_VERSION = "1";
const EMBEDDING_MODEL = "Xenova/multilingual-e5-small";
const EMBEDDING_DIM = 384;
const CHUNK_SIZE = 650;
const CHUNK_OVERLAP = 100;
const BATCH_SIZE = 16;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_PATH = path.join(ROOT, "src", "data", "catalog.json");
const POSTERS_DIR = path.join(ROOT, "public", "posters");
const OUT_DIR = path.join(ROOT, "public", "rag");
const INDEX_PATH = path.join(OUT_DIR, "index.json");
const VECTORS_PATH = path.join(OUT_DIR, "vectors.bin");
const MODEL_CACHE_DIR = path.join(ROOT, ".cache", "transformers");
const FONTS_DIR = path.join(ROOT, "public", "pdfjs", "standard_fonts");

const force = process.argv.includes("--force");

function log(message) {
  console.log(`[rag] ${message}`);
}

function collapse(text) {
  return text.replace(/\s+/g, " ").trim();
}

function posterFileName(pdfPath) {
  return path.basename(pdfPath).toLowerCase();
}

async function loadCatalog() {
  const raw = await readFile(CATALOG_PATH, "utf8");
  return JSON.parse(raw);
}

async function listPdfs() {
  if (!existsSync(POSTERS_DIR)) return [];
  const names = await readdir(POSTERS_DIR);
  return names.filter((name) => name.toLowerCase().endsWith(".pdf")).sort();
}

async function computeHash(catalog, pdfNames) {
  const hash = createHash("sha256");
  hash.update(`script:${SCRIPT_VERSION}\nmodel:${EMBEDDING_MODEL}\nchunk:${CHUNK_SIZE}/${CHUNK_OVERLAP}\n`);
  // Re-serialize so CRLF/LF differences in the checkout never change the hash.
  hash.update(JSON.stringify(catalog));
  for (const name of pdfNames) {
    hash.update(`\n${name}\n`);
    hash.update(await readFile(path.join(POSTERS_DIR, name)));
  }
  return hash.digest("hex");
}

/** Splits text into ~size character chunks with overlap, preferring sentence/word boundaries. */
function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const clean = collapse(text);
  if (clean.length === 0) return [];
  if (clean.length <= size) return [clean];
  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const sentence = Math.max(window.lastIndexOf(". "), window.lastIndexOf("; "));
      const space = window.lastIndexOf(" ");
      const cut = sentence > size * 0.6 ? sentence + 1 : space > size * 0.6 ? space : -1;
      if (cut > 0) end = start + cut;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    let next = end - overlap;
    // Start the next chunk on a word boundary.
    const boundary = clean.indexOf(" ", next);
    if (boundary !== -1 && boundary < end) next = boundary + 1;
    start = Math.max(next, start + 1);
  }
  return chunks;
}

async function extractPdfPages(pdfjs, filePath) {
  const data = new Uint8Array(await readFile(filePath));
  const task = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
    verbosity: 0,
    standardFontDataUrl: pathToFileURL(`${FONTS_DIR}${path.sep}`).href,
  });
  const doc = await task.promise;
  const pages = [];
  for (let number = 1; number <= doc.numPages; number += 1) {
    const page = await doc.getPage(number);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str;
      text += item.hasEOL ? "\n" : " ";
    }
    pages.push({ number, text: collapse(text) });
    page.cleanup();
  }
  await task.destroy();
  return pages;
}

function posterIndex(catalog) {
  const map = new Map();
  for (const category of catalog.categories) {
    for (const poster of category.posters) {
      map.set(posterFileName(poster.pdf), { poster, category });
    }
  }
  return map;
}

function posterChunkText(poster, category) {
  return collapse(
    `${poster.title}. Estudiantes: ${poster.students.join(", ")}. Docente: ${poster.advisor}. ` +
      `Semestre: ${poster.semester}. Categoría: ${category.name}. Resumen: ${poster.summary}`,
  );
}

function pageChunks(catalog) {
  const total = catalog.categories.reduce((sum, c) => sum + c.posters.length, 0);
  const names = catalog.categories.map((c) => c.name).join("; ");
  const pages = [
    [
      "about",
      "¿Qué es este sitio?",
      `Este sitio es el Repositorio de Proyectos de Aula del Programa de Fisioterapia, Facultad de Salud, Universidad Santiago de Cali (USC). Reúne ${total} pósteres académicos de proyectos de aula organizados en ${catalog.categories.length} categorías, con búsqueda, lectura del PDF dentro de la página y descarga directa.`,
    ],
    [
      "categories",
      "Categorías del repositorio",
      `Las categorías del repositorio son: ${names}. Cada categoría tiene su propia pestaña en la sección Pósteres por categoría.`,
    ],
    [
      "search",
      "Cómo buscar un póster",
      "Para buscar un póster use el campo Buscar proyectos del encabezado: escriba parte del título, el nombre de un estudiante o del docente. La búsqueda ignora tildes y mayúsculas, y los resultados aparecen agrupados por categoría. También puede elegir una categoría desde el menú Categorías o desde las pestañas de la sección Pósteres por categoría.",
    ],
    [
      "pdf",
      "Cómo abrir y descargar un PDF",
      "Cada tarjeta de póster tiene el botón Ver PDF completo, que abre el documento en un visor dentro de la página (se cierra con la tecla Esc), y el botón Descargar PDF, que guarda el archivo en su dispositivo.",
    ],
    [
      "assistant",
      "Asistente virtual",
      "El asistente virtual responde preguntas sobre los pósteres usando únicamente el contenido del repositorio y cita sus fuentes. Funciona en el dispositivo del visitante: las preguntas no se envían a ningún servidor. Con un navegador compatible con WebGPU puede activar la IA local (descarga única); en otros navegadores usa el modo búsqueda. También puede llevar al visitante a una categoría o abrir un póster.",
    ],
  ];
  return pages.map(([key, title, text]) => ({
    id: `page:${key}`,
    text,
    title,
    source: "page",
  }));
}

async function collectChunks(catalog, pdfNames) {
  const chunks = [];
  const byFile = posterIndex(catalog);

  chunks.push(...pageChunks(catalog));

  for (const category of catalog.categories) {
    const titles = category.posters.map((p) => p.title).join("; ");
    chunks.push({
      id: `catalog:category:${category.slug}`,
      text: collapse(
        `Categoría ${category.name}. ${category.description} Pósteres de esta categoría (${category.posters.length}): ${titles}.`,
      ),
      title: category.name,
      source: "catalog",
      categorySlug: category.slug,
    });
    for (const poster of category.posters) {
      chunks.push({
        id: `catalog:poster:${poster.slug}`,
        text: posterChunkText(poster, category),
        title: poster.title,
        source: "catalog",
        posterSlug: poster.slug,
        categorySlug: category.slug,
      });
    }
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  let pdfChunkCount = 0;
  for (const name of pdfNames) {
    const entry = byFile.get(name.toLowerCase());
    const title = entry ? entry.poster.title : name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ");
    let pages;
    try {
      pages = await extractPdfPages(pdfjs, path.join(POSTERS_DIR, name));
    } catch (error) {
      log(`warning: could not read ${name}: ${error instanceof Error ? error.message : error}`);
      continue;
    }
    for (const page of pages) {
      chunkText(page.text).forEach((text, index) => {
        chunks.push({
          id: `pdf:${name.replace(/\.pdf$/i, "")}:p${page.number}:${index}`,
          text,
          title,
          source: "pdf",
          ...(entry ? { posterSlug: entry.poster.slug, categorySlug: entry.category.slug } : {}),
          page: page.number,
        });
        pdfChunkCount += 1;
      });
    }
  }
  log(`${pdfNames.length} PDF files -> ${pdfChunkCount} text chunks`);
  return chunks;
}

async function embedChunks(chunks) {
  const { pipeline, env } = await import("@huggingface/transformers");
  env.cacheDir = MODEL_CACHE_DIR;
  log(`loading ${EMBEDDING_MODEL} (first run downloads the model)...`);
  const extractor = await pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "q8" });
  const vectors = new Float32Array(chunks.length * EMBEDDING_DIM);
  for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
    const batch = chunks.slice(start, start + BATCH_SIZE);
    const inputs = batch.map((chunk) => `passage: ${chunk.title}. ${chunk.text}`);
    const output = await extractor(inputs, { pooling: "mean", normalize: true });
    const [rows, dim] = output.dims;
    if (dim !== EMBEDDING_DIM || rows !== batch.length) {
      throw new Error(`Unexpected embedding shape ${output.dims.join("x")}`);
    }
    vectors.set(output.data, start * EMBEDDING_DIM);
    log(`embedded ${Math.min(start + BATCH_SIZE, chunks.length)}/${chunks.length}`);
  }
  await extractor.dispose?.();
  return vectors;
}

async function readExistingHash() {
  try {
    const existing = JSON.parse(await readFile(INDEX_PATH, "utf8"));
    return existsSync(VECTORS_PATH) ? existing.hash : null;
  } catch {
    return null;
  }
}

async function main() {
  const catalog = await loadCatalog();
  const pdfNames = await listPdfs();
  const hash = await computeHash(catalog, pdfNames);

  if (!force && (await readExistingHash()) === hash) {
    log("index up to date");
    return;
  }

  const chunks = await collectChunks(catalog, pdfNames);
  let vectors;
  try {
    vectors = await embedChunks(chunks);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (existsSync(INDEX_PATH) && existsSync(VECTORS_PATH)) {
      console.warn(`[rag] WARNING: embedding failed (${message}). Keeping the existing, possibly stale, index.`);
      return;
    }
    throw error;
  }

  await mkdir(OUT_DIR, { recursive: true });
  const index = {
    version: 1,
    model: EMBEDDING_MODEL,
    dim: EMBEDDING_DIM,
    hash,
    createdAt: new Date().toISOString(),
    chunks,
  };
  await writeFile(INDEX_PATH, JSON.stringify(index));
  await writeFile(VECTORS_PATH, Buffer.from(vectors.buffer, vectors.byteOffset, vectors.byteLength));
  log(`wrote ${chunks.length} chunks to public/rag (index.json + vectors.bin)`);
}

main().catch((error) => {
  console.error("[rag] failed:", error);
  process.exit(1);
});
