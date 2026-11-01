import raw from "./catalog.json";
import type { CatalogData, Category, Poster } from "./types";

/**
 * Typed view over `catalog.json`. The same JSON is read by
 * `scripts/generate-posters.mjs`, so editing the JSON updates both the UI and the PDFs.
 */
export const catalog: CatalogData = raw as CatalogData;

export const categories: Category[] = catalog.categories;

export const totalPosters: number = categories.reduce(
  (sum, category) => sum + category.posters.length,
  0,
);

export function findCategory(slug: string | null | undefined): Category | undefined {
  return categories.find((category) => category.slug === slug);
}

export type { Category, Poster };
