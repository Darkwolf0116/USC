"use client";

import { SearchX } from "lucide-react";
import { useCatalog } from "./CatalogProvider";
import { Highlight } from "./Highlight";
import { PosterGrid } from "./PosterGrid";

export function SearchResults() {
  const { state, actions, meta } = useCatalog();
  const { resultCount, results, searchTerms } = meta;

  if (resultCount === 0) {
    return (
      <div className="empty">
        <SearchX size={36} aria-hidden="true" />
        <h2 className="empty__title">No encontramos documentos para “{state.searchTerm}”</h2>
        <p className="empty__text">
          Revisa la ortografía o prueba con otra palabra del título o con el nombre de un eje.
        </p>
        <button type="button" className="btn btn--secondary" onClick={actions.clearQuery}>
          Limpiar búsqueda
        </button>
      </div>
    );
  }

  return (
    <div className="results">
      <p className="results__summary">
        {resultCount} {resultCount === 1 ? "resultado" : "resultados"} para “{state.searchTerm}”
      </p>
      {results.map(({ category, posters }) => (
        <section className="results__group" key={category.slug} aria-labelledby={`group-${category.slug}`}>
          <h2 className="results__title" id={`group-${category.slug}`}>
            <Highlight text={`Eje ${category.number}: ${category.name}`} terms={searchTerms} />
          </h2>
          <PosterGrid posters={posters} categorySlug={category.slug} terms={searchTerms} />
        </section>
      ))}
      <div>
        <button type="button" className="btn btn--secondary" onClick={actions.clearQuery}>
          Limpiar búsqueda
        </button>
      </div>
    </div>
  );
}
