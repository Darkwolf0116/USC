"use client";

import { CATALOG_SECTION_ID } from "@/lib/constants";
import { useCatalog } from "./CatalogProvider";
import { CategoryPanel } from "./CategoryPanel";
import { CategoryTabs } from "./CategoryTabs";
import { SearchResults } from "./SearchResults";

/** Categories area: tabs and a poster grid, or grouped search results while a query is active. */
export function CategoriesSection() {
  const { meta } = useCatalog();

  return (
    <section id={CATALOG_SECTION_ID} className="catalog" aria-labelledby="catalog-title">
      <div className="container">
        <header className="catalog__head">
          <h2 className="catalog__title" id="catalog-title">
            Pósteres por categoría
          </h2>
          <p className="catalog__intro">
            {meta.categories.length} categorías y {meta.totalPosters} pósteres de la muestra.
          </p>
        </header>

        <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
          {meta.announcement}
        </p>

        <div className="catalog__layout">
          {meta.isSearching ? null : (
            <div className="catalog__index">
              <p className="catalog__index-title" aria-hidden="true">
                Categorías
              </p>
              <CategoryTabs />
            </div>
          )}
          <div className="catalog__main">
            {meta.isSearching ? <SearchResults /> : <CategoryPanel />}
          </div>
        </div>
      </div>
    </section>
  );
}
