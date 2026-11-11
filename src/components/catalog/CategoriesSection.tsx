"use client";

import { CATALOG_SECTION_ID } from "@/lib/constants";
import { AxisSection } from "./AxisSection";
import { useCatalog } from "./CatalogProvider";
import { SearchResults } from "./SearchResults";

/** Catalog area: one section per research axis, or grouped search results while a query is active. */
export function CategoriesSection() {
  const { meta } = useCatalog();

  return (
    <section id={CATALOG_SECTION_ID} className="catalog" aria-labelledby="catalog-title">
      <div className="container">
        <header className="catalog__head">
          <h2 className="catalog__title" id="catalog-title">
            Ejes de investigación
          </h2>
          <p className="catalog__intro">
            {meta.categories.length} ejes y {meta.totalPosters} documentos.
          </p>
        </header>

        <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
          {meta.announcement}
        </p>

        {meta.isSearching ? (
          <SearchResults />
        ) : (
          <div className="catalog__axes">
            {meta.categories.map((category) => (
              <AxisSection key={category.slug} category={category} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
