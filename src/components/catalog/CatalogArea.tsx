"use client";

import type { ReactNode } from "react";
import { CATALOG_SECTION_ID } from "@/lib/constants";
import { useCatalog } from "./CatalogProvider";
import { SearchResults } from "./SearchResults";

/** Shows the page content, or grouped search results while a query is active. */
export function CatalogArea({ children }: { children: ReactNode }) {
  const { meta } = useCatalog();

  return (
    <>
      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {meta.announcement}
      </p>
      {meta.isSearching ? (
        <section id={CATALOG_SECTION_ID} className="catalog" aria-label="Resultados de búsqueda">
          <div className="container">
            <SearchResults />
          </div>
        </section>
      ) : (
        children
      )}
    </>
  );
}
