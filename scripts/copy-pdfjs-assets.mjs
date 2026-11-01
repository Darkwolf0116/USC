/**
 * Copies the PDF.js standard font data into public/pdfjs so react-pdf can render
 * PDFs that reference non-embedded base fonts (such as the generated posters).
 * Run with `npm run pdfjs-assets` after upgrading react-pdf. The copied files are committed.
 */
import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const pdfjsRoot = path.dirname(require.resolve("pdfjs-dist/package.json"));
const target = path.join(root, "public", "pdfjs", "standard_fonts");

await mkdir(target, { recursive: true });
await cp(path.join(pdfjsRoot, "standard_fonts"), target, { recursive: true });
console.log(`Copied standard fonts to ${path.relative(root, target)}`);
