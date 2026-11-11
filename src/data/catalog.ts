import raw from "./catalog.json";
import type { CatalogData, Category, Poster } from "./types";

/**
 * Typed view over `catalog.json`, which `scripts/build-axes.mjs` generates from `Ejes/`.
 * Do not edit the JSON by hand: change the PDFs or `title-overrides.json` and re-run `npm run axes`.
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
