/**
 * Imports the research-axis PDFs dropped in `Ejes/` into the site.
 *
 *   Ejes/<"Eje N" + axis name>/<file>.pdf
 *     -> public/ejes/eje-N/<slug>.pdf      (published PDF)
 *     -> public/ejes/eje-N/<slug>.webp     (first-page thumbnail)
 *     -> src/data/catalog.json             (4 axes, one entry per PDF)
 *
 * Titles come from the file name, cleaned of numbering prefixes, underscores and extra
 * spaces. When the PDF metadata title matches it (ignoring accents and case) the metadata
 * spelling wins, which restores accents lost in file names. `src/data/title-overrides.json`
 * (keyed by original file name) wins over everything.
 *
 * Usage: npm run axes
 */
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, "Ejes");
const PUBLIC_DIR = path.join(ROOT, "public", "ejes");
const CATALOG_PATH = path.join(ROOT, "src", "data", "catalog.json");
const OVERRIDES_PATH = path.join(ROOT, "src", "data", "title-overrides.json");
const FONTS_URL = pathToFileURL(path.join(ROOT, "node_modules", "pdfjs-dist", "standard_fonts") + path.sep).href;
const THUMBNAIL_WIDTH = 480;
const THUMBNAIL_QUALITY = 80;

function log(message) {
  console.log(`[axes] ${message}`);
}

function stripAccents(text) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function comparable(text) {
  return stripAccents(text).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function slugify(text) {
  return comparable(text).replace(/\s+/g, "-").slice(0, 80).replace(/-+$/, "");
}

/** "01_Cuidando_espaldas_pequenas.pdf" -> "Cuidando espaldas pequenas". */
export function cleanFileTitle(fileName) {
  let title = fileName.replace(/\.pdf$/i, "");
  title = title.replace(/_/g, " ");
  title = title.replace(/^\s*\d+\s*[.)-]?\s+/, "");
  // Windows file names cannot hold ":", so authors typed "Title- subtitle".
  title = title.replace(/(\S)- /g, "$1: ");
  title = title.replace(/\s+/g, " ").trim();
  if (title.startsWith("¿") && !title.includes("?")) title = `${title}?`;
  return title;
}

/** "EJE 1 Innovación, Tecnología y Emprendimiento" -> { number: 1, name: "Innovación, ..." }. */
function parseAxisFolder(folder) {
  const match = folder.match(/^\s*eje\s*(\d+)\s*[-.:]?\s*(.+)$/i);
  if (!match) return null;
  return { number: Number(match[1]), name: match[2].replace(/\s+/g, " ").trim() };
}

function fileOrder(fileName) {
  const match = fileName.match(/^\s*(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

async function readPdf(filePath) {
  const task = getDocument({
    data: new Uint8Array(await readFile(filePath)),
    standardFontDataUrl: FONTS_URL,
    verbosity: 0,
  });
  const doc = await task.promise;
  try {
    const metadata = await doc.getMetadata().catch(() => null);
    const metaTitle = String(metadata?.info?.Title ?? "").replace(/\s+/g, " ").trim();
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: THUMBNAIL_WIDTH / base.width });
    const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    const thumbnail = await canvas.encode("webp", THUMBNAIL_QUALITY);
    return {
      metaTitle,
      pages: doc.numPages,
      thumbnail,
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    await task.destroy();
  }
}

async function main() {
  if (!existsSync(SOURCE_DIR)) {
    throw new Error(`Missing source folder: ${SOURCE_DIR}`);
  }
  const overrides = existsSync(OVERRIDES_PATH) ? JSON.parse(await readFile(OVERRIDES_PATH, "utf8")) : {};

  const folders = (await readdir(SOURCE_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ folder: entry.name, axis: parseAxisFolder(entry.name) }))
    .filter((entry) => {
      if (!entry.axis) log(`skipping folder without "Eje N" prefix: ${entry.folder}`);
      return entry.axis;
    })
    .sort((a, b) => a.axis.number - b.axis.number);

  await rm(PUBLIC_DIR, { recursive: true, force: true });
  const categories = [];

  for (const { folder, axis } of folders) {
    const slug = `eje-${axis.number}`;
    const outDir = path.join(PUBLIC_DIR, slug);
    await mkdir(outDir, { recursive: true });

    const files = (await readdir(path.join(SOURCE_DIR, folder)))
      .filter((name) => name.toLowerCase().endsWith(".pdf"))
      .sort((a, b) => fileOrder(a) - fileOrder(b) || a.localeCompare(b, "es"));

    const usedSlugs = new Set();
    const posters = [];
    log(`Eje ${axis.number} · ${axis.name} (${files.length} PDF)`);

    for (const fileName of files) {
      const source = path.join(SOURCE_DIR, folder, fileName);
      const pdf = await readPdf(source);
      const fromFile = cleanFileTitle(fileName);
      const title =
        overrides[fileName] ??
        (pdf.metaTitle && comparable(pdf.metaTitle) === comparable(fromFile) ? pdf.metaTitle : fromFile);

      let posterSlug = slugify(title) || "documento";
      for (let n = 2; usedSlugs.has(posterSlug); n += 1) posterSlug = `${slugify(title)}-${n}`;
      usedSlugs.add(posterSlug);

      await copyFile(source, path.join(outDir, `${posterSlug}.pdf`));
      await writeFile(path.join(outDir, `${posterSlug}.webp`), pdf.thumbnail);

      posters.push({
        slug: posterSlug,
        title,
        pdf: `/ejes/${slug}/${posterSlug}.pdf`,
        thumbnail: `/ejes/${slug}/${posterSlug}.webp`,
        thumbnailWidth: pdf.width,
        thumbnailHeight: pdf.height,
        pages: pdf.pages,
      });
      log(`  ${title}`);
    }

    categories.push({ slug, number: axis.number, name: axis.name, posters });
  }

  await writeFile(CATALOG_PATH, `${JSON.stringify({ categories }, null, 2)}\n`);
  const total = categories.reduce((sum, c) => sum + c.posters.length, 0);
  log(`wrote ${categories.length} axes and ${total} PDF to src/data/catalog.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
