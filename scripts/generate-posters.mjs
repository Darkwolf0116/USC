/**
 * Generates one illustrative A3 academic poster PDF per catalog entry.
 *
 * Reads  src/data/catalog.json and public/Info/logo.png
 * Writes public/posters/<slug>.pdf
 *
 * The PDFs are mockups: names, text and chart values are illustrative placeholders.
 * Replace them with real files (same name, or update `pdf` in catalog.json) when available.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "src", "data", "catalog.json");
const logoPath = path.join(root, "public", "Info", "logo.png");
const outDir = path.join(root, "public", "posters");

// A3 portrait in PostScript points.
const PAGE_W = 841.89;
const PAGE_H = 1190.55;
const MARGIN = 48;
const COLUMN_GAP = 30;
const COLUMN_W = (PAGE_W - MARGIN * 2 - COLUMN_GAP) / 2;

const NAVY = rgb(0, 0.1686, 0.2863); // #002B49
const HEALTH = rgb(0, 0.4667, 0.7137); // #0077B6
const GOLD = rgb(0.8314, 0.6863, 0.2157); // #D4AF37
const INK = rgb(0.0588, 0.1176, 0.1804); // #0F1E2E
const MUTED = rgb(0.2902, 0.3647, 0.4392); // #4A5D70
const PAPER = rgb(0.9725, 0.9804, 0.9882); // #F8FAFC
const RULE = rgb(0.8353, 0.8706, 0.9098); // #D5DEE8
const WHITE = rgb(1, 1, 1);

/** Small deterministic hash so each poster gets stable, different chart values. */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seeded(seed) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return (s % 10000) / 10000;
  };
}

/** Replace characters outside WinAnsi so StandardFonts never throws. */
function clean(text) {
  return text
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\u0000-ÿ•]/g, "");
}

function wrap(text, font, size, maxWidth) {
  const words = clean(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Builds placeholder section text from the catalog entry. */
function buildSections(poster, category) {
  const topic = lowerFirst(poster.title.replace(/\.$/, ""));
  const summary = poster.summary;
  const area = lowerFirst(category.name);
  return {
    intro: [
      `En el marco de la asignatura ${category.name}, este trabajo aborda el siguiente tema: ${topic}.`,
      `${summary} El tema se relaciona con las competencias del programa de Fisioterapia y con situaciones frecuentes de la práctica profesional.`,
      "La revisión inicial permitió identificar vacíos en la información disponible y definir una pregunta orientadora para el proyecto de aula.",
    ],
    objective: [
      `Desarrollar una propuesta académica sobre ${topic}, que integre fundamentos teóricos y criterios aplicables en la práctica de ${area}.`,
      "Objetivos específicos: describir el contexto, organizar la evidencia consultada y proponer recomendaciones claras para su uso en el aula.",
    ],
    method: [
      "Proyecto de aula con enfoque descriptivo. Se consultaron fuentes académicas, guías de práctica y material de clase, y se registraron los criterios de selección.",
      "La información se organizó en matrices de síntesis y fue revisada con el docente asesor en tres encuentros de seguimiento.",
      "Los datos del gráfico son ilustrativos y no corresponden a mediciones reales.",
    ],
    results: [
      "Se identificaron los elementos centrales del tema y se agruparon en categorías de análisis que facilitan su comprensión.",
      "La Figura 1 muestra una comparación ilustrativa entre dos momentos de seguimiento, con el fin de ejemplificar cómo se presentarían los hallazgos.",
    ],
    conclusions: [
      `El trabajo permitió comprender mejor ${topic} y reconocer su utilidad para la toma de decisiones en ${area}.`,
      "Se recomienda profundizar con estudios de mayor alcance y validar la propuesta en escenarios de práctica supervisada.",
      "Este póster es un ejemplo ilustrativo del formato que usará el repositorio.",
    ],
    references: [
      "[1] Apellido, N. (2024). Referencia ilustrativa sobre el tema central del póster. Revista de Fisioterapia, 12(3), 45-58.",
      "[2] Apellido, M. y Apellido, P. (2023). Guía de práctica clínica de ejemplo. Editorial Académica.",
      "[3] Programa de Fisioterapia. (2026). Material de clase y lecturas de la asignatura.",
    ],
  };
}

async function main() {
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const logoBytes = await readFile(logoPath);
  await mkdir(outDir, { recursive: true });

  let count = 0;
  for (const category of catalog.categories) {
    for (const poster of category.posters) {
      const bytes = await renderPoster(poster, category, logoBytes);
      const file = path.join(outDir, `${poster.slug}.pdf`);
      await writeFile(file, bytes);
      count += 1;
    }
  }

  await writeFile(
    path.join(outDir, "README.txt"),
    [
      "Pósteres ilustrativos del repositorio de proyectos de aula.",
      "",
      "Estos PDF se generan con `npm run posters` a partir de src/data/catalog.json.",
      "Son maquetas: los nombres y contenidos son ficticios.",
      "Para usar archivos reales, copie el PDF en esta carpeta y actualice el campo `pdf` en catalog.json.",
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(`Generated ${count} poster PDFs in ${path.relative(root, outDir)}`);
}

async function renderPoster(poster, category, logoBytes) {
  const doc = await PDFDocument.create();
  doc.setTitle(clean(poster.title));
  doc.setAuthor(clean(poster.students.join(", ")));
  doc.setSubject(clean(`${category.name}. Póster ilustrativo`));
  doc.setKeywords(["fisioterapia", "póster", "USC", clean(category.name)]);
  doc.setCreator("Repositorio de Proyectos de Aula - Fisioterapia USC");
  doc.setProducer("pdf-lib");
  doc.setLanguage?.("es-CO");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(logoBytes);
  const page = doc.addPage([PAGE_W, PAGE_H]);

  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAPER });

  // Header band with logo and institutional line.
  const headerH = 150;
  page.drawRectangle({ x: 0, y: PAGE_H - headerH, width: PAGE_W, height: headerH, color: NAVY });
  const logoH = 118;
  const logoW = (logo.width / logo.height) * logoH;
  page.drawImage(logo, { x: MARGIN, y: PAGE_H - headerH + (headerH - logoH) / 2, width: logoW, height: logoH });
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_H - headerH + (headerH - logoH) / 2,
    width: logoW,
    height: logoH,
    borderColor: GOLD,
    borderWidth: 1.5,
  });
  const textX = MARGIN + logoW + 28;
  const textW = PAGE_W - textX - MARGIN;
  const institution = "Universidad Santiago de Cali · Facultad de Salud · Programa de Fisioterapia";
  const instLines = wrap(institution, bold, 21, textW);
  let y = PAGE_H - headerH / 2 + (instLines.length * 26) / 2 - 18;
  for (const line of instLines) {
    page.drawText(line, { x: textX, y, size: 21, font: bold, color: WHITE });
    y -= 26;
  }
  page.drawText("Muestra Académica de Proyectos de Aula", {
    x: textX,
    y: y - 4,
    size: 13,
    font: regular,
    color: GOLD,
  });

  // Gold rule.
  page.drawRectangle({ x: 0, y: PAGE_H - headerH - 6, width: PAGE_W, height: 6, color: GOLD });

  // Title block.
  let cursor = PAGE_H - headerH - 6 - 56;
  const titleLines = wrap(poster.title, bold, 33, PAGE_W - MARGIN * 2);
  for (const line of titleLines) {
    page.drawText(line, { x: MARGIN, y: cursor, size: 33, font: bold, color: NAVY });
    cursor -= 40;
  }
  cursor -= 6;

  const studentsLine = `Estudiantes: ${poster.students.join(", ")}`;
  for (const line of wrap(studentsLine, regular, 16, PAGE_W - MARGIN * 2)) {
    page.drawText(line, { x: MARGIN, y: cursor, size: 16, font: regular, color: INK });
    cursor -= 21;
  }
  page.drawText(`Docente: ${clean(poster.advisor)}`, { x: MARGIN, y: cursor, size: 16, font: regular, color: INK });
  cursor -= 21;
  for (const line of wrap(`${category.name}. Semestre ${poster.semester}`, bold, 14, PAGE_W - MARGIN * 2)) {
    page.drawText(line, { x: MARGIN, y: cursor, size: 14, font: bold, color: HEALTH });
    cursor -= 19;
  }
  cursor -= 8;
  page.drawRectangle({ x: MARGIN, y: cursor, width: PAGE_W - MARGIN * 2, height: 1.5, color: RULE });
  cursor -= 34;

  const sections = buildSections(poster, category);
  const bodySize = 12;
  const lead = 16.5;
  const colX = [MARGIN, MARGIN + COLUMN_W + COLUMN_GAP];
  const colY = [cursor, cursor];
  const bottomLimit = 68;

  function drawHeading(col, text) {
    page.drawText(text, { x: colX[col], y: colY[col], size: 18, font: bold, color: NAVY });
    page.drawRectangle({ x: colX[col], y: colY[col] - 9, width: 44, height: 3, color: GOLD });
    colY[col] -= 31;
  }

  function drawParagraphs(col, paragraphs, opts = {}) {
    const size = opts.size ?? bodySize;
    const font = opts.font ?? regular;
    for (const text of paragraphs) {
      for (const line of wrap(text, font, size, COLUMN_W)) {
        page.drawText(line, { x: colX[col], y: colY[col], size, font, color: opts.color ?? INK });
        colY[col] -= opts.lead ?? lead;
      }
      colY[col] -= 7;
    }
    colY[col] -= 10;
  }

  function drawChart(col) {
    const rand = seeded(hash(poster.slug));
    const chartH = 112;
    const x0 = colX[col];
    const top = colY[col];
    const base = top - chartH;
    page.drawRectangle({ x: x0, y: base - 26, width: COLUMN_W, height: chartH + 26, color: WHITE, borderColor: RULE, borderWidth: 1 });
    // Axes
    page.drawLine({ start: { x: x0 + 34, y: base }, end: { x: x0 + COLUMN_W - 14, y: base }, thickness: 1, color: MUTED });
    page.drawLine({ start: { x: x0 + 34, y: base }, end: { x: x0 + 34, y: top - 14 }, thickness: 1, color: MUTED });
    const groups = ["A", "B", "C", "D"];
    const groupW = (COLUMN_W - 34 - 14) / groups.length;
    groups.forEach((label, i) => {
      const gx = x0 + 34 + i * groupW + 10;
      const before = 30 + rand() * 40;
      const after = Math.min(120, before + 15 + rand() * 40);
      page.drawRectangle({ x: gx, y: base + 1, width: 22, height: before, color: HEALTH });
      page.drawRectangle({ x: gx + 26, y: base + 1, width: 22, height: after, color: GOLD });
      page.drawText(`Grupo ${label}`, { x: gx, y: base - 15, size: 10, font: regular, color: MUTED });
    });
    // Legend
    page.drawRectangle({ x: x0 + 42, y: top - 12, width: 10, height: 10, color: HEALTH });
    page.drawText("Valoración inicial", { x: x0 + 57, y: top - 11, size: 10, font: regular, color: INK });
    page.drawRectangle({ x: x0 + 160, y: top - 12, width: 10, height: 10, color: GOLD });
    page.drawText("Valoración final", { x: x0 + 175, y: top - 11, size: 10, font: regular, color: INK });
    colY[col] = base - 26 - 16;
    page.drawText("Figura 1. Gráfico ilustrativo con datos de ejemplo.", {
      x: x0,
      y: colY[col],
      size: 10.5,
      font: regular,
      color: MUTED,
    });
    colY[col] -= 22;
  }

  drawHeading(0, "Introducción");
  drawParagraphs(0, sections.intro);
  drawHeading(0, "Objetivo");
  drawParagraphs(0, sections.objective);
  drawHeading(0, "Metodología");
  drawParagraphs(0, sections.method);

  drawHeading(1, "Resultados");
  drawParagraphs(1, sections.results);
  drawChart(1);
  drawHeading(1, "Conclusiones");
  drawParagraphs(1, sections.conclusions);
  drawHeading(1, "Referencias");
  drawParagraphs(1, sections.references, { size: 11, lead: 15, color: MUTED });

  const lowest = Math.min(colY[0], colY[1]);
  if (lowest < bottomLimit) {
    console.warn(`  Warning: content of "${poster.slug}" reaches the footer area (${Math.round(lowest)}).`);
  }

  // Footer note.
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 56, color: NAVY });
  page.drawRectangle({ x: 0, y: 56, width: PAGE_W, height: 3, color: GOLD });
  page.drawText("Póster ilustrativo de un proyecto de aula. Nombres y contenidos ficticios.", {
    x: MARGIN,
    y: 22,
    size: 12,
    font: regular,
    color: WHITE,
  });

  return doc.save();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
